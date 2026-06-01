import User from '../models/User';

export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOtp = async (phone: string): Promise<{ success: boolean; message: string }> => {
  const otp = generateOtp();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const user = await User.findOne({ phone });
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  user.otp = otp;
  user.otpExpiry = otpExpiry;
  await user.save();

  // In v1, log OTP to console (no SMS service)
  console.log(`\n🔐 OTP for ${phone}: ${otp} (expires in 10 minutes)\n`);

  return { success: true, message: 'OTP sent successfully' };
};

export const verifyOtp = async (
  phone: string,
  otp: string
): Promise<{ success: boolean; message: string }> => {
  const user = await User.findOne({ phone });
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (!user.otp || !user.otpExpiry) {
    return { success: false, message: 'No OTP requested' };
  }

  if (user.otpExpiry < new Date()) {
    return { success: false, message: 'OTP expired' };
  }

  if (user.otp !== otp) {
    return { success: false, message: 'Invalid OTP' };
  }

  // Clear OTP after successful verification
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.isVerified = true;
  await user.save();

  return { success: true, message: 'OTP verified successfully' };
};
