const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const nodemailer = require('nodemailer');
const router = express.Router();

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/gmail.send'];
const TOKEN_PATH = 'token.json';
router.post('/authenticate', (req, res) => {
    const { code } = req.body;
    const oAuth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.REDIRECT_URI
    );

    oAuth2Client.getToken(code, (err, token) => {
        if (err) return res.status(400).json({ error: 'Error retrieving access token' });
        if (!token.refresh_token) {
            console.log('No refresh token available. Previous tokens might be reused.');
        }
        // oAuth2Client.setCredentials(token);
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return res.status(400).json({ error: 'Error saving access token' });
            res.status(200).json({ message: 'Authentication successful' });
        });
    });
});

router.get('/events', (req, res) => {
    const filter = req.query.filter || '';
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return res.status(400).json({ error: 'Authentication required' });

        const oAuth2Client = new google.auth.OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.REDIRECT_URI
        );
        oAuth2Client.setCredentials(JSON.parse(token));

        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime',
        }, async (err, result) => {
            if (err) return res.status(400).json({ error: 'Error fetching events' });
            const events = result.data.items.filter(event => event.summary && event.summary.includes(filter));
            for (let event of events) {
                if (event.attendees) {
                    const attendeePromises = event.attendees.map(async attendee => {
                        attendee.name = await fetchAttendeeName(oAuth2Client, attendee.email);
                        // console.log(attendee)
                    });

                    await Promise.all(attendeePromises);
                }
            }
            res.status(200).json({ events });
        });
    });
});

router.post('/sendReminder', async (req, res) => {
    const { event } = req.body;
    const { attendees, summary, start } = event;

    fs.readFile(TOKEN_PATH, async (err, token) => {
        if (err) return res.status(400).json({ error: 'Authentication required' });

        const credentials = JSON.parse(token);
        const oAuth2Client = new google.auth.OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.REDIRECT_URI
        );
        oAuth2Client.setCredentials(credentials);

        try {
            for (let attendee of attendees) {
                if (attendee["organizer"] != true) {
                    const name = await fetchAttendeeName(oAuth2Client, "lesley.yc.chen@gmail.com");
                    // console.log(attendee)
                    const emailBody = `Hi ${attendee.name},\n\nThis is a reminder for your upcoming meeting:\n\nDetails:\n${summary} - ${start.dateTime}\n\nBest regards,\nH7 Accelerator Program`;
                    await sendEmail(oAuth2Client, attendee.email, 'Meeting Reminder', emailBody);
                }
            }
            res.status(200).json({ message: 'Emails sent' });
        } catch (error) {
            console.error('Error sending reminders:', error);
            res.status(500).json({ error: 'Failed to send emails' });
        }
    });
});

const sendEmail = async (auth, to, subject, messageText) => {
    const gmail = google.gmail({ version: 'v1', auth });

    // The email needs to be encoded in base64 format
    const encodedMessage = Buffer.from(
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `Content-Type: text/plain; charset="UTF-8"\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Transfer-Encoding: 7bit\r\n\r\n` +
        `${messageText}`
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    try {
        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });
        // console.log('Email sent:', res.data);
        return res.data;
    } catch (error) {
        console.error('Failed to send email:', error);
        throw new Error(error);
    }
};

const fetchAttendeeName = async (auth, specifiedEmail) => {
    const peopleService = google.people({ version: 'v1', auth });
    try {
        const response = await peopleService.otherContacts.list({
            readMask: 'names,emailAddresses',
            pageSize: 1000
        });

        const otherContacts = response.data.otherContacts;
        if (otherContacts && otherContacts.length > 0) {
            const contact = otherContacts.find(contact =>
                contact.emailAddresses && contact.emailAddresses.some(email => email.value === specifiedEmail)
            );
            if (contact && contact.names && contact.names.length > 0) {
                return contact.names[0].displayName;
            } else {
                return '';
            }
        } else {
            return 'No other contacts found';
        }
    } catch (error) {
        console.error('Failed to fetch other contacts:', error);
        throw new Error('Failed to fetch other contacts');
    }
};


module.exports = router;
