'use strict';
const button = document.querySelector('#copy');
button.addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(document.querySelector('#prompt').textContent);
    status.textContent = '已复制，粘贴到你的制作代理中即可。';
  } catch {
    status.textContent = '当前浏览器不允许自动复制，请选择上方文字手动复制。';
  }
});
