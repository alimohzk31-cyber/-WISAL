// Windows build-environment workaround: Node 25 can throw ENOMEM from
// os.userInfo() in restricted sessions before the Capacitor CLI starts.
const os = require('node:os');
const originalUserInfo = os.userInfo;
os.userInfo = (...args) => {
  try {
    return originalUserInfo(...args);
  } catch {
    return {
      uid: -1,
      gid: -1,
      username: process.env.USERNAME || 'builder',
      homedir: process.env.USERPROFILE || process.cwd(),
      shell: process.env.COMSPEC || 'cmd.exe',
    };
  }
};
