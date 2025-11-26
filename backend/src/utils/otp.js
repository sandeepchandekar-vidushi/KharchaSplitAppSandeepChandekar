/**
 * Generate OTP code
 */
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

/**
 * Calculate OTP expiry time
 */
const getOTPExpiry = (minutes = 10) => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
};

/**
 * Send OTP via SMS (placeholder - implement with Twilio or similar)
 */
const sendOTPviaSMS = async (phoneNumber, otp) => {
  // TODO: Implement SMS sending logic using Twilio
  console.log(`📱 Sending OTP ${otp} to ${phoneNumber}`);

  if (process.env.NODE_ENV === 'development') {
    console.log(`⚠️  DEV MODE: OTP is ${otp}`);
    return true;
  }

  // Example Twilio implementation:
  // import twilio from 'twilio.js';
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: `Your KharchaSplit verification code is: ${otp}`,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber
  // });

  return true;
};

export {
  generateOTP,
  getOTPExpiry,
  sendOTPviaSMS,
};
