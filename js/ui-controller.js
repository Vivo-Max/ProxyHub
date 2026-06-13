// UI Controller - UI 交互、主题、拖拽、背景设置控制

class UIController {
  constructor() {
    this.theme = localStorage.getItem('theme') || 'light';
    this.defaultBgImage = {
      light: 'radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.18) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(139, 92, 246, 0.16) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.14) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(139, 92, 246, 0.12) 0px, transparent 50%), linear-gradient(180deg, #f0f4f8 0%, #e2e8f0 100%)',
      dark: 'radial-gradient(at 0% 0%, rgba(96, 165, 250, 0.16) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(167, 139, 250, 0.14) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(96, 165, 250, 0.12) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(167, 139, 250, 0.10) 0px, transparent 50%), linear-gradient(180deg, #0f172a 0%, #1e293b 100%)'
    };
    this.initTheme();
    this.bindEvents();
    this.loadAppearanceSettings();
    this.initNavScroll();
  }

  // 检测导航标签是否溢出，控制居中/滚动样式
  initNavScroll() {
    const checkNav = () => {
      const nav = document.querySelector('.nav-tabs');
      if (!nav) return;
      // 当内容宽度大于容器宽度时，添加 has-scroll 类
      if (nav.scrollWidth > nav.clientWidth + 2) {
        nav.classList.add('has-scroll');
      } else {
        nav.classList.remove('has-scroll');
      }
    };
    checkNav();
    window.addEventListener('resize', checkNav);
  }

  initTheme() {
    const isDark = this.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.innerHTML = isDark
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="icon-dark h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg><svg xmlns="http://www.w3.org/2000/svg" class="icon-light h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="icon-light h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg><svg xmlns="http://www.w3.org/2000/svg" class="icon-dark h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
    }
  }

  toggleTheme() {
    const next = this.theme === 'light' ? 'dark' : 'light';
    const apply = () => {
      this.theme = next;
      localStorage.setItem('theme', next);
      this.initTheme();
      this.applyBackground();
      // Re-apply panel opacity for new theme color
      const savedAlpha = localStorage.getItem('panelOpacity');
      if (savedAlpha !== null) {
        const alpha = parseFloat(savedAlpha);
        const pct = Math.round(((alpha - 0.15) / 0.8) * 100);
        this.setOpacity(Math.max(0, Math.min(100, pct)), false);
      }
    };

    if (!document.startViewTransition) {
      apply();
      return;
    }

    document.documentElement.classList.add('theme-animating');
    const transition = document.startViewTransition(apply);
    transition.finished.finally(() => {
      document.documentElement.classList.remove('theme-animating');
    });
  }

  bindEvents() {
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (window.app && window.app.handleFiles) window.app.handleFiles(e.dataTransfer.files);
      });
    }

    const nodeInput = document.getElementById('nodeInput');
    if (nodeInput) {
      nodeInput.addEventListener('input', () => {
        localStorage.setItem('ph_nodeInput', JSON.stringify(nodeInput.value));
      });
    }

    // 背景透明度 / 磨砂强度
    const bgOpacity = document.getElementById('bgOpacity');
    const bgBlur = document.getElementById('bgBlur');
    if (bgOpacity) bgOpacity.addEventListener('input', (e) => this.setOpacity(e.target.value));
    if (bgBlur) bgBlur.addEventListener('input', (e) => this.setBlur(e.target.value));

    // 背景类型切换
    document.querySelectorAll('input[name="bgType"]').forEach(radio => {
      radio.addEventListener('change', () => this.setBgType(radio.value));
    });

    // 设置弹窗标签切换
    document.querySelectorAll('.settings-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const content = document.getElementById(tab);
        if (content) content.classList.add('active');
      });
    });

    // 文字反色
    const textInvert = document.getElementById('textInvert');
    if (textInvert) textInvert.addEventListener('change', () => this.setTextInvert(textInvert.checked));

    // 图片上传
    const bgUploadZone = document.getElementById('bgUploadZone');
    const bgImageInput = document.getElementById('bgImageInput');
    if (bgUploadZone && bgImageInput) {
      bgUploadZone.addEventListener('click', () => bgImageInput.click());
      bgImageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.handleBgImageUpload(e.target.files[0]);
      });

      ['dragenter', 'dragover'].forEach(ev => {
        bgUploadZone.addEventListener(ev, (e) => {
          e.preventDefault();
          bgUploadZone.classList.add('drag-over');
        });
      });
      ['dragleave', 'drop'].forEach(ev => {
        bgUploadZone.addEventListener(ev, (e) => {
          e.preventDefault();
          bgUploadZone.classList.remove('drag-over');
        });
      });
      bgUploadZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) this.handleBgImageUpload(file);
      });
    }

    // 恢复默认背景
    document.getElementById('bgResetBtn')?.addEventListener('click', () => this.resetBackground());

    // 图片显示方式 / 固定方式 / 模糊 / 亮度
    const bgImageSize = document.getElementById('bgImageSize');
    const bgImageAttachment = document.getElementById('bgImageAttachment');
    const bgImageBlur = document.getElementById('bgImageBlur');
    const bgImageBrightness = document.getElementById('bgImageBrightness');

    if (bgImageSize) {
      bgImageSize.addEventListener('change', () => {
        localStorage.setItem('bgImageSize', bgImageSize.value);
        this.applyBackground();
      });
    }
    if (bgImageAttachment) {
      bgImageAttachment.addEventListener('change', () => {
        localStorage.setItem('bgImageAttachment', bgImageAttachment.value);
        this.applyBackground();
      });
    }
    if (bgImageBlur) bgImageBlur.addEventListener('input', (e) => this.setBgBlur(e.target.value));
    if (bgImageBrightness) bgImageBrightness.addEventListener('input', (e) => this.setBgBrightness(e.target.value));
  }

  loadAppearanceSettings() {
    // 透明度 / 磨砂
    const savedAlpha = localStorage.getItem('panelOpacity');
    const blur = localStorage.getItem('panelBlur');
    if (savedAlpha !== null) {
      const alpha = parseFloat(savedAlpha);
      const pct = Math.round(((alpha - 0.15) / 0.8) * 100);
      const slider = document.getElementById('bgOpacity');
      if (slider) slider.value = Math.max(0, Math.min(100, pct));
      this.setOpacity(Math.max(0, Math.min(100, pct)), false);
    } else {
      // Apply default alpha (0.52) matching CSS default
      const isDark = document.documentElement.classList.contains('dark');
      const defaultAlpha = 0.52;
      if (isDark) {
        document.documentElement.style.setProperty('--card-bg', `rgba(30, 41, 59, ${defaultAlpha})`);
        document.documentElement.style.setProperty('--card-bg-hover', `rgba(30, 41, 59, ${(defaultAlpha + 0.05).toFixed(2)})`);
      } else {
        document.documentElement.style.setProperty('--card-bg', `rgba(255, 255, 255, ${defaultAlpha})`);
        document.documentElement.style.setProperty('--card-bg-hover', `rgba(255, 255, 255, ${(defaultAlpha + 0.1).toFixed(2)})`);
      }
    }
    if (blur !== null) {
      const slider = document.getElementById('bgBlur');
      if (slider) slider.value = parseInt(blur);
      this.setBlur(parseInt(blur), false);
    }

    // 背景类型与图片
    const bgType = localStorage.getItem('bgType') || 'gradient';
    const bgImageData = localStorage.getItem('bgImageData');
    const bgImageSize = localStorage.getItem('bgImageSize') || 'cover';
    const bgImageAttachment = localStorage.getItem('bgImageAttachment') || 'fixed';
    const bgImageBlur = localStorage.getItem('bgImageBlur') || '0';
    const bgImageBrightness = localStorage.getItem('bgImageBrightness') || '100';
    const textInvert = localStorage.getItem('textInvert') === 'true';

    const sizeSelect = document.getElementById('bgImageSize');
    const attachmentSelect = document.getElementById('bgImageAttachment');
    const blurSlider = document.getElementById('bgImageBlur');
    const brightnessSlider = document.getElementById('bgImageBrightness');
    const textInvertCheckbox = document.getElementById('textInvert');

    if (sizeSelect) sizeSelect.value = bgImageSize;
    if (attachmentSelect) attachmentSelect.value = bgImageAttachment;
    if (blurSlider) blurSlider.value = parseInt(bgImageBlur);
    if (brightnessSlider) brightnessSlider.value = parseInt(bgImageBrightness);
    if (textInvertCheckbox) textInvertCheckbox.checked = textInvert;

    this.setBgBlur(parseInt(bgImageBlur), false);
    this.setBgBrightness(parseInt(bgImageBrightness), false);
    this.setTextInvert(textInvert, false);

    const radio = document.querySelector(`input[name="bgType"][value="${bgType}"]`);
    if (radio) radio.checked = true;
    this.setBgType(bgType, false);

    if (bgType === 'image' && bgImageData) {
      this.showBgPreview(bgImageData);
    } else {
      this.applyBackground();
    }
  }

  setOpacity(value, save = true) {
    // Map slider 0-100 to alpha range 0.15-0.95
    // 0% = nearly transparent (0.15), 100% = nearly solid (0.95)
    const pct = Math.max(0, Math.min(100, parseInt(value) || 0));
    const alpha = 0.15 + (pct / 100) * 0.8;
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.style.setProperty('--card-bg', `rgba(30, 41, 59, ${alpha.toFixed(2)})`);
      document.documentElement.style.setProperty('--card-bg-hover', `rgba(30, 41, 59, ${(alpha + 0.05).toFixed(2)})`);
    } else {
      document.documentElement.style.setProperty('--card-bg', `rgba(255, 255, 255, ${alpha.toFixed(2)})`);
      document.documentElement.style.setProperty('--card-bg-hover', `rgba(255, 255, 255, ${(alpha + 0.1).toFixed(2)})`);
    }
    const display = document.getElementById('bgOpacityValue');
    if (display) display.textContent = `${pct}%`;
    if (save) localStorage.setItem('panelOpacity', String(alpha));
  }

  setBlur(value, save = true) {
    const blur = `${value}px`;
    document.documentElement.style.setProperty('--frosted-blur', blur);
    document.documentElement.style.setProperty('--frosted-blur-hover', `${parseInt(value) + 5}px`);
    const display = document.getElementById('bgBlurValue');
    if (display) display.textContent = blur;
    if (save) localStorage.setItem('panelBlur', value);
  }

  setBgType(type, save = true) {
    if (save) localStorage.setItem('bgType', type);
    this.applyBackground();
  }

  setTextInvert(enabled, save = true) {
    document.documentElement.setAttribute('data-text-invert', String(enabled));
    if (save) localStorage.setItem('textInvert', String(enabled));
  }

  setBgBlur(value, save = true) {
    const blur = `${value}px`;
    const display = document.getElementById('bgImageBlurValue');
    if (display) display.textContent = blur;
    if (save) localStorage.setItem('bgImageBlur', value);
    this.applyBackground();
  }

  setBgBrightness(value, save = true) {
    const brightness = `${value}%`;
    const display = document.getElementById('bgImageBrightnessValue');
    if (display) display.textContent = brightness;
    if (save) localStorage.setItem('bgImageBrightness', value);
    this.applyBackground();
  }

  handleBgImageUpload(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const isValidType = validTypes.includes(file.type);
    const isValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValidType && !isValidExt) {
      this.showToast('请选择有效的图片文件（JPG/PNG/GIF/WebP/BMP/SVG）', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.showToast('图片过大，请选择 2MB 以内的图片', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      localStorage.setItem('bgImageData', dataUrl);
      this.showBgPreview(dataUrl);
      this.applyBackground();
      this.showToast('背景图片已应用', 'success');
    };
    reader.onerror = () => {
      this.showToast('图片读取失败', 'error');
    };
    reader.readAsDataURL(file);
  }

  showBgPreview(dataUrl) {
    const status = document.getElementById('bgUploadStatus');
    const uploadZone = document.getElementById('bgUploadZone');
    if (status) status.style.display = 'flex';
    if (uploadZone) uploadZone.style.display = 'none';
  }

  hideBgPreview() {
    const status = document.getElementById('bgUploadStatus');
    const uploadZone = document.getElementById('bgUploadZone');
    if (status) status.style.display = 'none';
    if (uploadZone) uploadZone.style.display = 'block';
  }

  resetBackground() {
    localStorage.removeItem('bgImageData');
    localStorage.setItem('bgType', 'gradient');
    localStorage.setItem('bgImageBlur', '0');
    localStorage.setItem('bgImageBrightness', '100');

    const radio = document.getElementById('bgTypeGradient');
    if (radio) radio.checked = true;

    const blurSlider = document.getElementById('bgImageBlur');
    const brightnessSlider = document.getElementById('bgImageBrightness');
    if (blurSlider) blurSlider.value = 0;
    if (brightnessSlider) brightnessSlider.value = 100;

    this.setBgBlur(0, false);
    this.setBgBrightness(100, false);
    this.hideBgPreview();
    this.setBgType('gradient', false);
    this.showToast('已恢复默认背景', 'info');
  }

  applyBackground() {
    const bgType = localStorage.getItem('bgType') || 'gradient';
    const bgLayer = document.getElementById('bgLayer');
    if (!bgLayer) return;

    const blur = localStorage.getItem('bgImageBlur') || '0';
    const brightness = localStorage.getItem('bgImageBrightness') || '100';

    if (bgType === 'image') {
      const dataUrl = localStorage.getItem('bgImageData');
      if (dataUrl) {
        const sizeSelect = document.getElementById('bgImageSize');
        const size = sizeSelect ? sizeSelect.value : 'cover';
        const attachmentSelect = document.getElementById('bgImageAttachment');
        const attachment = attachmentSelect ? attachmentSelect.value : 'fixed';

        bgLayer.style.background = `url(${dataUrl})`;
        bgLayer.style.backgroundSize = size === 'center' ? 'auto' : size;
        bgLayer.style.backgroundPosition = size === 'center' ? 'center center' : 'center';
        bgLayer.style.backgroundRepeat = size === 'auto' ? 'repeat' : 'no-repeat';
        bgLayer.style.backgroundAttachment = attachment;
        bgLayer.style.filter = `blur(${blur}px) brightness(${brightness}%)`;
        document.body.classList.add('custom-wallpaper');
        return;
      }
    }

    // 默认渐变
    document.body.classList.remove('custom-wallpaper');
    bgLayer.style.background = this.defaultBgImage[this.theme] || this.defaultBgImage.light;
    bgLayer.style.backgroundSize = 'cover';
    bgLayer.style.backgroundPosition = 'center';
    bgLayer.style.backgroundRepeat = 'no-repeat';
    bgLayer.style.backgroundAttachment = 'fixed';
    bgLayer.style.filter = 'none';
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconMap = { success: '\u2705', error: '\u274c', info: '\u2139\ufe0f' };
    toast.innerHTML = `<span>${iconMap[type] || '\u2139\ufe0f'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}
