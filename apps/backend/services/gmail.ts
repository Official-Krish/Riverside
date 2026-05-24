import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const EMAIL_FROM = process.env.EMAIL_FROM || "Weave <noreply@krishlabs.tech>";

export async function sendGmailMessage(
  recipientEmail: string,
  eventDetails: {
    hostedby: string;
    summary: string;
    description: string;
    startDateTime: string;
    attendees: string[];
  },
) {
  try {
    const startDate = new Date(eventDetails.startDateTime);
    const formattedTime = startDate.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const attendeeList =
      eventDetails.attendees.length > 0
        ? eventDetails.attendees
            .map(
              (e) =>
                `<span style="background:#1e1a12;color:#f5a623;padding:2px 8px;border-radius:999px;font-size:13px;margin:2px 2px;display:inline-block;">${e}</span>`,
            )
            .join(" ")
        : `<span style="color:#888;">No additional attendees</span>`;

    await resend.emails.send({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject: `📅 Meeting Invitation: ${eventDetails.summary}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Meeting Invitation</title>
</head>
<body style="margin:0;padding:0;background:#0c0b0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0b0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1408 0%,#241c0a 100%);border-radius:16px 16px 0 0;padding:32px 36px;border-bottom:1px solid #f5a623;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#f5a623;opacity:0.7;">Weave · Meeting Invitation</p>
                    <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#fff5de;line-height:1.25;">${eventDetails.summary}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#111009;padding:32px 36px;">

              <!-- Hosted by & time -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <div style="background:#1a1408;border:1px solid rgba(245,166,35,0.18);border-radius:12px;padding:16px;">
                      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b49650;opacity:0.7;">Hosted by</p>
                      <p style="margin:0;font-size:15px;font-weight:700;color:#fff5de;">${eventDetails.hostedby}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <div style="background:#1a1408;border:1px solid rgba(245,166,35,0.18);border-radius:12px;padding:16px;">
                      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b49650;opacity:0.7;">Start time</p>
                      <p style="margin:0;font-size:14px;font-weight:700;color:#fff5de;">${formattedTime}</p>
                    </div>
                  </td>
                </tr>
              </table>

              ${
                eventDetails.description
                  ? `
              <!-- Description -->
              <div style="background:#1a1408;border:1px solid rgba(245,166,35,0.12);border-radius:12px;padding:16px;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b49650;opacity:0.7;">Description</p>
                <p style="margin:0;font-size:14px;color:#c5ac72;line-height:1.6;">${eventDetails.description}</p>
              </div>`
                  : ""
              }

              <!-- Attendees -->
              <div style="background:#1a1408;border:1px solid rgba(245,166,35,0.12);border-radius:12px;padding:16px;margin-bottom:32px;">
                <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b49650;opacity:0.7;">Attendees</p>
                <div>${attendeeList}</div>
              </div>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://weave.krishlabs.tech/dashboard?section=upcoming"
                       style="display:inline-block;background:linear-gradient(135deg,#ffd166,#f5a623);color:#1b1100;font-size:15px;font-weight:800;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.01em;">
                      View Upcoming Meetings
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#6b5c35;text-align:center;line-height:1.6;">
                Log in to your Weave account and open <em>Upcoming Meetings</em> to join when the meeting starts.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d0c0a;border-radius:0 0 16px 16px;padding:20px 36px;border-top:1px solid rgba(245,166,35,0.1);text-align:center;">
              <p style="margin:0;font-size:12px;color:#4a3e22;">Weave &middot; Video &amp; Voice Conferencing</p>
              <p style="margin:4px 0 0;font-size:11px;color:#3a3020;">You received this because you were invited to a scheduled meeting.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}
