const axios = require('axios');

const MAKECOM_WEBHOOK_URL = process.env.MAKECOM_WEBHOOK_URL;

async function sendProfileToMake(payload) {
  if (!MAKECOM_WEBHOOK_URL || MAKECOM_WEBHOOK_URL === 'your_makecom_webhook_url_here') {
    console.log('Make.com webhook not configured, skipping...');
    return { status: 'not_configured', message: 'Webhook URL not set' };
  }

  try {
    const response = await axios.post(MAKECOM_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return {
      status: 'success',
      data: response.data,
      statusCode: response.status
    };

  } catch (error) {
    console.error('Make.com webhook error:', error.response?.data || error.message);

    return {
      status: 'error',
      error: error.response?.data || error.message,
      statusCode: error.response?.status
    };
  }
}

module.exports = {
  sendProfileToMake
};
