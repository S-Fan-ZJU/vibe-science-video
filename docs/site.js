'use strict';

const copyButton = document.querySelector('#copy');
if (copyButton) {
  copyButton.addEventListener('click', async () => {
    const status = document.querySelector('#copy-status');
    try {
      await navigator.clipboard.writeText(document.querySelector('#prompt').textContent);
      status.textContent = '已复制，粘贴到你的制作代理中即可。';
    } catch {
      status.textContent = '当前浏览器不允许自动复制，请选择上方文字手动复制。';
    }
  });
}

const videos = [...document.querySelectorAll('video')];
const playButtons = [...document.querySelectorAll('[data-play-video]')];
const galleryStatus = document.querySelector('#gallery-status');

const loadPoster = (video) => {
  if (video.dataset.poster) {
    video.poster = video.dataset.poster;
    delete video.dataset.poster;
  }
};

if ('IntersectionObserver' in window) {
  const posterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        loadPoster(entry.target);
        posterObserver.unobserve(entry.target);
      }
    });
  }, {rootMargin: '400px 0px'});
  document.querySelectorAll('video[data-poster]').forEach((video) => posterObserver.observe(video));
} else {
  videos.forEach(loadPoster);
}

const syncPlayback = (video) => {
  const playing = !video.paused && !video.ended;
  const frame = video.closest('.video-shell');
  if (frame) frame.dataset.playing = String(playing);
  playButtons.filter((button) => button.dataset.playVideo === video.id).forEach((button) => {
    const title = document.getElementById(video.getAttribute('aria-labelledby'));
    const titleText = title ? title.textContent.replace(/\s+/g, '') : '此';
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', `${playing ? '暂停' : '播放'}${titleText}样片`);
    button.querySelector('.play-label').textContent = playing ? '暂停播放' : '播放样片';
    button.querySelector('.play-icon').textContent = playing ? 'Ⅱ' : '▶';
  });
};

videos.forEach((video) => {
  video.addEventListener('play', () => {
    videos.forEach((other) => { if (other !== video && !other.paused) other.pause(); });
    if (galleryStatus) galleryStatus.textContent = '';
    syncPlayback(video);
  });
  video.addEventListener('pause', () => syncPlayback(video));
  video.addEventListener('ended', () => syncPlayback(video));
});

playButtons.forEach((button) => {
  const video = document.getElementById(button.dataset.playVideo);
  if (!video) return;
  button.addEventListener('click', async () => {
    loadPoster(video);
    if (!video.paused && !video.ended) {
      video.pause();
      return;
    }
    try {
      if (video.ended) video.currentTime = 0;
      await video.play();
    } catch (error) {
      if (error.name !== 'AbortError' && galleryStatus) {
        galleryStatus.textContent = '暂时无法播放，请稍后重试，或使用视频自带的播放按钮。';
      }
      syncPlayback(video);
    }
  });
});
