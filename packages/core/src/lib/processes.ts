export function isRunning(pid: number) {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    // EPERM: it runs, as another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
