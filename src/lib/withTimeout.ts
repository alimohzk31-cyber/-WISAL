// Bound reads only. Mutations must never be retried automatically after a timeout.
export function withTimeout<T>(operation: PromiseLike<T>, milliseconds = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('انتهت مهلة التحميل. تحقق من اتصال الإنترنت وأعد المحاولة.')), milliseconds);
    Promise.resolve(operation).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}
