import path from "node:path";
import {
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

type StorageClientOptions = {
	region?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
};

type StorageContextOptions = StorageClientOptions & {
	bucketName?: string;
	cdnBaseUrl?: string;
};

type PublicLinkOptions = {
	recordingsRoot?: string;
	cdnBaseUrl?: string;
	apiRecordingsPrefix?: string;
};

const DEFAULT_CDN_BASE_URL = "https://cdn.krishlabs.tech/weave-recordings";
const DEFAULT_API_RECORDINGS_PREFIX = "/api/v1/recordings/";

export function normalizeS3Key(value: string) {
	return value.replace(/^\/+/, "").replace(/\\/g, "/");
}

export function buildS3Key(...parts: string[]) {
	return parts
		.filter(Boolean)
		.map((value) => value.replace(/^\/+|\/+$/g, ""))
		.filter(Boolean)
		.join("/");
}

export function createS3Client(options: StorageClientOptions = {}) {
	return new S3Client({
		region: options.region || process.env.AWS_REGION,
		credentials:
			options.accessKeyId && options.secretAccessKey
				? {
						accessKeyId: options.accessKeyId,
						secretAccessKey: options.secretAccessKey,
					}
				: process.env.AWS_ACCESS_KEY && process.env.AWS_SECRET_ACCESS_KEY
				? {
						accessKeyId: process.env.AWS_ACCESS_KEY,
						secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
					}
				: undefined,
	});
}

export function resolveStorageContext(options: StorageContextOptions = {}) {
	const bucketName = options.bucketName || process.env.AWS_BUCKET_NAME;
	if (!bucketName) {
		throw new Error("AWS_BUCKET_NAME is not configured");
	}

	const cdnBaseUrl = (options.cdnBaseUrl || process.env.CDN_BASE_URL || DEFAULT_CDN_BASE_URL).replace(/\/$/, "");

	return {
		s3Client: createS3Client(options),
		bucketName,
		cdnBaseUrl,
	};
}

export function keyToCdnUrl(key: string, cdnBaseUrl = process.env.CDN_BASE_URL || DEFAULT_CDN_BASE_URL) {
	return `${cdnBaseUrl.replace(/\/$/, "")}/${normalizeS3Key(key)}`;
}

export function tryExtractS3Key(value: string | null | undefined, options: Pick<PublicLinkOptions, "recordingsRoot" | "apiRecordingsPrefix"> = {}) {
	if (!value) {
		return null;
	}

	const trimmed = String(value).trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		try {
			return normalizeS3Key(new URL(trimmed).pathname);
		} catch {
			return null;
		}
	}

	const prefix = options.apiRecordingsPrefix || DEFAULT_API_RECORDINGS_PREFIX;
	if (trimmed.startsWith(prefix)) {
		return normalizeS3Key(trimmed.replace(prefix, ""));
	}

	if (options.recordingsRoot && trimmed.startsWith(options.recordingsRoot)) {
		const relative = path.relative(options.recordingsRoot, trimmed).split(path.sep).join("/");
		return relative && !relative.startsWith("..") ? normalizeS3Key(relative) : null;
	}

	return normalizeS3Key(trimmed);
}

export function toPublicRecordingLink(value: string, options: PublicLinkOptions = {}) {
	const key = tryExtractS3Key(value, options);
	if (!key) {
		return value;
	}
	return keyToCdnUrl(key, options.cdnBaseUrl || process.env.CDN_BASE_URL || DEFAULT_CDN_BASE_URL);
}

export async function putObjectToS3(args: {
	s3Client: S3Client;
	bucketName: string;
	key: string;
	body: Buffer | Uint8Array | string;
	contentType?: string;
}) {
	await args.s3Client.send(
		new PutObjectCommand({
			Bucket: args.bucketName,
			Key: normalizeS3Key(args.key),
			Body: args.body,
			ContentType: args.contentType,
		})
	);
}

export async function getObjectBytesFromS3(args: {
	s3Client: S3Client;
	bucketName: string;
	key: string;
}) {
	const response = await args.s3Client.send(
		new GetObjectCommand({
			Bucket: args.bucketName,
			Key: normalizeS3Key(args.key),
		})
	);

	const bytes = await response.Body?.transformToByteArray();
	return bytes ? Buffer.from(bytes) : null;
}

export async function listObjectKeysByPrefix(args: {
	s3Client: S3Client;
	bucketName: string;
	prefix: string;
	keyFilter?: (key: string) => boolean;
}) {
	const safePrefix = normalizeS3Key(args.prefix);
	const keys: string[] = [];

	let continuationToken: string | undefined;
	do {
		const listRes = await args.s3Client.send(
			new ListObjectsV2Command({
				Bucket: args.bucketName,
				Prefix: safePrefix,
				ContinuationToken: continuationToken,
			})
		);

		for (const key of (listRes.Contents || []).map((item) => item.Key)) {
			if (typeof key !== "string") {
				continue;
			}

			if (!args.keyFilter || args.keyFilter(key)) {
				keys.push(key);
			}
		}

		continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
	} while (continuationToken);

	return keys;
}

export async function deleteObjectFromS3(args: {
	s3Client: S3Client;
	bucketName: string;
	key: string;
}) {
	await args.s3Client.send(
		new DeleteObjectCommand({
			Bucket: args.bucketName,
			Key: normalizeS3Key(args.key),
		})
	);
}

export async function deleteKeysFromS3(args: {
	s3Client: S3Client;
	bucketName: string;
	keys: string[];
}) {
	const normalized = args.keys.map((key) => normalizeS3Key(key)).filter(Boolean);
	if (normalized.length === 0) {
		return;
	}

	await args.s3Client.send(
		new DeleteObjectsCommand({
			Bucket: args.bucketName,
			Delete: {
				Objects: normalized.map((key) => ({ Key: key })),
				Quiet: true,
			},
		})
	);
}

export async function deletePrefixFromS3(args: {
	s3Client: S3Client;
	bucketName: string;
	prefix: string;
}) {
	const keys = await listObjectKeysByPrefix({
		s3Client: args.s3Client,
		bucketName: args.bucketName,
		prefix: args.prefix,
	});

	if (keys.length === 0) {
		return;
	}

	for (let i = 0; i < keys.length; i += 1000) {
		const batch = keys.slice(i, i + 1000);
		await deleteKeysFromS3({
			s3Client: args.s3Client,
			bucketName: args.bucketName,
			keys: batch,
		});
	}
}