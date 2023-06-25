const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
require('dotenv').config();
const authClient = new OAuth2Client ({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri:  process.env.REDIRECT_URI,
});

const gmail = google.gmail({ version: 'v1', auth: authClient });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.MAIL_ID,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN
  },
});


// Helper function to send an email
async function sendEmail(subject, message, to) {

  const mailOptions = {
    from: process.env.MAIL_ID,
    to,
    subject,
    text: message,
  };

  await transporter.sendMail(mailOptions);
}

// Helper function to add a label to an email
async function addLabelToEmail(userId, emailId, labelId) {
  await gmail.users.messages.modify({
    userId,
    id: emailId,
    resource: {
      addLabelIds: [labelId],
    },
  });
}

// Helper function to move an email to a label
async function moveEmailToLabel(userId, emailId, labelId) {
  await gmail.users.messages.modify({
    userId,
    id: emailId,
    resource: {
      addLabelIds: [labelId],
      removeLabelIds: ['INBOX'],
    },
  });
}

async function checkNewEmails() {

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox is:unread -{thread:}'
  }); 

  const messages = res.data.messages || [];

  for (const message of messages) {
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
    });

    const headers = email.data.payload.headers;
    const hasReply = headers.some(header => header.name === 'In-Reply-To');

    if (!hasReply) {
      // Reply to the email
      const replySubject = 'I am out on vacation..!!';
      const replyMessage = 'Hi, Greetings of the day..!! Currently i am out on vacation. If you need any assistance plz contact to Anubhav (anubhav359@gmail.com)';
      console.log(replySubject,replyMessage,headers.find(header => header.name === 'From').value,"-----");
      await sendEmail(replySubject, replyMessage, headers.find(header => header.name === 'From').value);

      // Add a label to the email and move it
      const labelName = `Label ${new Date()}`;

      const label = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
          name: labelName,
        },
      });

      const labelId = label.data.id;

      await addLabelToEmail('me', message.id, labelId);
      await moveEmailToLabel('me', message.id, labelId);
    }
  }
}

// Function to run the email checking and replying sequence at random intervals
function runSequence() {
  const minInterval = 45; // Minimum interval in seconds
  const maxInterval = 120; // Maximum interval in seconds

  let interval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
  console.log(`Checking for new emails and replying in ${interval} seconds...`);

  setTimeout(async () => {
    try {
      await checkNewEmails();
    } catch (error) {
      console.error('An error occurred:', error.message);
    }

    runSequence();
  }, interval * 1000);
}

// Perform the OAuth2 authentication
async function performAuthentication() {
  const authUrl = authClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.modify'],
  });

  console.log(`Authorize this app by visiting this URL: ${authUrl}`);

  const code = "my authorisation code";//'<Authorization code>'; // Replace with the authorization code obtained from the URL
  const { tokens } = await authClient.getToken(code);
  authClient.setCredentials(tokens);

  console.log('Authentication successful!');
  runSequence();
}

// Start the authentication process
performAuthentication();