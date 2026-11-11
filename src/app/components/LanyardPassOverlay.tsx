// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Lanyard from './Lanyard';
import { ArrowRight } from 'lucide-react';
import ShinyText from './ShinyText';
import Magnet from './Magnet';
import moonLogoWhite from '../../assets/white.png';

interface LanyardPassOverlayProps {
  user: string;
  role?: string;
  institution?: string;
  type: 'login' | 'signup';
  isAr?: boolean;
  onProceed: () => void;
}

export function LanyardPassOverlay({
  user,
  role = 'BIBFRAME Linked Data Tester',
  institution = 'National Library / Research Center',
  type,
  isAr = false,
  onProceed,
}: LanyardPassOverlayProps) {
  const [frontDataUrl, setFrontDataUrl] = useState<string | null>(null);
  const [backDataUrl, setBackDataUrl] = useState<string | null>(null);
  const [strapDataUrl, setStrapDataUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const renderAll = () => {
      const userHash = Math.random().toString(36).substring(2, 8).toUpperCase();
      const userHandle = '@' + (user || 'isaac').toLowerCase().replace(/\s+/g, '');

      // Helper: create a tinted version of white.png
      const createTintedLogo = (color: string, alpha: number = 1) => {
        const tCanvas = document.createElement('canvas');
        tCanvas.width = img.width || 1024;
        tCanvas.height = img.height || 489;
        const tctx = tCanvas.getContext('2d');
        if (!tctx) return tCanvas;
        tctx.clearRect(0, 0, tCanvas.width, tCanvas.height);
        tctx.drawImage(img, 0, 0);
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = color;
        tctx.globalAlpha = alpha;
        tctx.fillRect(0, 0, tCanvas.width, tCanvas.height);
        return tCanvas;
      };

      const blackLogo = createTintedLogo('#0f172a', 1.0);
      const watermarkLogo = createTintedLogo('#000000', 0.08);

      // ==========================================
      // 1. STRAP (256 x 512) - Black with white Moon logo
      // ==========================================
      const strapCanvas = document.createElement('canvas');
      strapCanvas.width = 256;
      strapCanvas.height = 512;
      const sctx = strapCanvas.getContext('2d');
      if (sctx) {
        sctx.fillStyle = '#0f1115';
        sctx.fillRect(0, 0, 256, 512);

        // Center white Moon logo on strap
        const sw = 190;
        const sh = ((img.height || 489) / (img.width || 1024)) * sw;
        sctx.drawImage(img, (256 - sw) / 2, (512 - sh) / 2, sw, sh);
        setStrapDataUrl(strapCanvas.toDataURL('image/png'));
      }

      // ==========================================
      // 2. FRONT FACE (1024 x 1440) - Minimalist White
      // ==========================================
      const frontCanvas = document.createElement('canvas');
      frontCanvas.width = 1024;
      frontCanvas.height = 1440;
      const fctx = frontCanvas.getContext('2d');
      if (fctx) {
        // Pure White Card
        fctx.fillStyle = '#ffffff';
        fctx.fillRect(0, 0, 1024, 1440);

        // Subtle inset border
        fctx.beginPath();
        fctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
        fctx.lineWidth = 2;
        fctx.roundRect(28, 28, 1024 - 56, 1440 - 56, 32);
        fctx.stroke();

        // Top Row: Watermark Logo (Left) and Handle (Right)
        const topLogoW = 120;
        const topLogoH = ((img.height || 489) / (img.width || 1024)) * topLogoW;
        fctx.drawImage(watermarkLogo, 70, 190, topLogoW, topLogoH);

        // Top Right User Handle (@username)
        fctx.font = '700 28px -apple-system, BlinkMacSystemFont, monospace';
        fctx.fillStyle = '#64748b';
        fctx.textAlign = 'right';
        fctx.fillText(userHandle, 954, 215);

        // Center: Black Moon Wordmark Logo
        const centerLogoW = 500;
        const centerLogoH = ((img.height || 489) / (img.width || 1024)) * centerLogoW;
        fctx.drawImage(blackLogo, (1024 - centerLogoW) / 2, 400, centerLogoW, centerLogoH);

        // Center Information & Typography
        fctx.textAlign = 'center';

        // Full Name
        fctx.font = '900 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        fctx.fillStyle = '#0f172a';
        fctx.fillText((user || 'Isaac Faleh').toUpperCase(), 512, 720);

        // Role Badge Pill
        const roleText = (role || 'BIBFRAME Linked Data Tester').toUpperCase();
        fctx.font = '800 18px monospace';
        const roleWidth = Math.max(340, fctx.measureText(roleText).width + 60);

        fctx.beginPath();
        fctx.fillStyle = '#f1f5f9';
        fctx.roundRect(512 - roleWidth / 2, 760, roleWidth, 46, 23);
        fctx.fill();
        fctx.strokeStyle = '#e2e8f0';
        fctx.lineWidth = 1.5;
        fctx.stroke();

        fctx.fillStyle = '#0f172a';
        fctx.fillText(roleText, 512, 790);

        // Institution / Affiliation
        fctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        fctx.fillStyle = '#475569';
        fctx.fillText(institution, 512, 860);

        // Platform line
        fctx.font = '700 15px monospace';
        fctx.fillStyle = '#94a3b8';
        fctx.fillText('BIBFRAME 3.0.1 • LINKED DATA PLATFORM', 512, 905);

        // Minimalist High-Tech Barcode at Bottom
        const plateY = 1030;
        fctx.fillStyle = '#0f172a';
        const barcodeSeed = (user + role).split('').reduce((acc, c) => acc + c.charCodeAt(0), 120);
        let curX = 160;
        let s = barcodeSeed;
        while (curX < 864) {
          s = (s * 9301 + 49297) % 233280;
          const w = (s / 233280 > 0.6) ? 4 : 2;
          const gap = Math.floor((s / 233280) * 6) + 3;
          fctx.fillRect(curX, plateY, w, 75);
          curX += w + gap;
        }

        // Serial Text
        fctx.fillStyle = '#94a3b8';
        fctx.font = '700 18px monospace';
        fctx.fillText(`SERIAL: BF3-MN-${userHash}-2026`, 512, plateY + 115);

        // Footer Attribution
        fctx.fillStyle = '#cbd5e1';
        fctx.font = '700 14px -apple-system, BlinkMacSystemFont, sans-serif';
        fctx.fillText('DESIGN & DEVELOPED BY ISAAC FALEH • MOON STUDIO', 512, 1240);

        setFrontDataUrl(frontCanvas.toDataURL('image/png'));
      }

      // ==========================================
      // 3. BACK FACE (1024 x 1440) - Minimalist Watermark & URL
      // ==========================================
      const backCanvas = document.createElement('canvas');
      backCanvas.width = 1024;
      backCanvas.height = 1440;
      const bctx = backCanvas.getContext('2d');
      if (bctx) {
        // Pure White Card
        bctx.fillStyle = '#ffffff';
        bctx.fillRect(0, 0, 1024, 1440);

        // Subtle inset border
        bctx.beginPath();
        bctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
        bctx.lineWidth = 2;
        bctx.roundRect(28, 28, 1024 - 56, 1440 - 56, 32);
        bctx.stroke();

        // Big Centered Moon Logo Watermark
        const backLogoW = 680;
        const backLogoH = ((img.height || 489) / (img.width || 1024)) * backLogoW;
        bctx.drawImage(watermarkLogo, (1024 - backLogoW) / 2, (1440 - backLogoH) / 2 - 40, backLogoW, backLogoH);

        // Bottom Website Monospace URL (like reactbits.dev)
        bctx.textAlign = 'center';
        bctx.font = '700 28px -apple-system, BlinkMacSystemFont, monospace';
        bctx.fillStyle = '#94a3b8';
        bctx.fillText('moon.studio', 512, 1280);

        setBackDataUrl(backCanvas.toDataURL('image/png'));
      }
    };

    img.onload = renderAll;
    img.src = moonLogoWhite;
    if (img.complete) {
      renderAll();
    }
  }, [user, role, institution]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      if (type === 'login') onProceed();
      return;
    }
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown, onProceed, type]);

  // Auto-flip after 7s (when countdown reaches 3, i.e. 10 - 7 = 3s remaining)
  useEffect(() => {
    if (countdown <= 3 && countdown > 0) {
      const lanyardEl = document.querySelector('.lanyard');
      if (lanyardEl && lanyardEl.__lanyardFlip) {
        lanyardEl.__lanyardFlip(undefined, 'back');
      }
    }
  }, [countdown]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between pointer-events-auto bg-black/85 backdrop-blur-xl select-none"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* 3D Interactive Lanyard Component Area (No top banner, full screen focus) */}
      <div className="flex-1 w-full max-w-5xl h-full relative flex items-center justify-center overflow-hidden">
        {frontDataUrl && backDataUrl ? (
          <Lanyard
            frontImage={frontDataUrl}
            backImage={backDataUrl}
            strapImage={strapDataUrl || undefined}
            cardColor="#ffffff"
            finish="glossy"
            metal="silver"
            strapColor="#111111"
            strapWidth={0.75}
            orientation="portrait"
            size={0.78}
            anchor="center"
            strapLength={0.32}
            interactive={true}
            intro={true}
            autoFlipAfter={7}
            breeze={0.16}
            elasticity={0.65}
            damping={0.46}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <div className="flex items-center gap-3 text-white/80">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="font-mono text-sm">Loading 3D Moon Pass...</span>
          </div>
        )}
      </div>

      {/* Bottom Floating Bar with Action Button & Interactive Controls */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 20 }}
        className="mb-8 flex flex-col items-center gap-2.5 max-w-[92vw]"
      >
        <div
          className="p-2 sm:p-2.5 rounded-2xl flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          style={{
            /* From https://css.glass */
            background: 'rgba(255, 255, 255, 0.52)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.95)',
          }}
        >
          <Magnet padding={40} magnetStrength={2}>
            <button
              type="button"
              onClick={onProceed}
              className="px-8 py-3 rounded-xl bg-slate-950 hover:bg-slate-900 active:scale-95 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg flex items-center gap-2.5 transition-all cursor-pointer"
            >
              <ShinyText
                text={type === 'login'
                  ? (isAr ? `دخول محرر MOON (${countdown}ث)` : `Enter Moon Studio (${countdown}s)`)
                  : (isAr ? 'المتابعة لتسجيل الدخول' : 'Proceed to Sign In')}
                color="#ffffff"
                shineColor="#e2e8f0"
                speed={3}
                className="font-black text-xs sm:text-sm tracking-wide text-white"
              />
              <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
            </button>
          </Magnet>
        </div>

        <span className="text-[11px] text-slate-300 font-medium tracking-wide">
          {isAr
            ? '✦ اسحب لتحريك البطاقة ثلاثية الأبعاد • انقر للقلب'
            : '✦ Try dragging to swing the 3D card • Click to flip over'}
        </span>
      </motion.div>
    </motion.div>
  );
}

export default LanyardPassOverlay;
