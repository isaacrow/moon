import React, { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/dist/CustomEase.js";
import { opacLang } from "./i18n";
import "./OpacEntrancePreloader.css";

gsap.registerPlugin(CustomEase);

interface OpacEntrancePreloaderProps {
  onComplete?: () => void;
}

export const OpacEntrancePreloader: React.FC<OpacEntrancePreloaderProps> = ({
  onComplete,
}) => {
  const legacyRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const constructionRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const unifiedRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<HTMLDivElement>(null);
  const blRef = useRef<HTMLDivElement>(null);
  const brRef = useRef<HTMLDivElement>(null);

  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const finishAndDismiss = useCallback(() => {
    setIsDismissed(true);
    const appEl = document.querySelector<HTMLElement>(".app");
    if (appEl) {
      appEl.classList.remove("opac-page-surface");
      appEl.classList.add("opac-page-revealed");
      gsap.set(appEl, { clearProps: "all" });
      const brandInNav = appEl.querySelector<HTMLElement>(".brand");
      if (brandInNav) {
        gsap.set(brandInNav, { clearProps: "all" });
      }
    }
    if (legacyRef.current) legacyRef.current.style.display = "none";
    if (scrimRef.current) scrimRef.current.style.display = "none";
    if (stageRef.current) stageRef.current.style.display = "none";
    onComplete?.();
  }, [onComplete]);

  const runAnimation = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    const legacyView = legacyRef.current;
    const scrim = scrimRef.current;
    const construction = constructionRef.current;
    const brandWordmark = wordmarkRef.current;
    const unifiedLogo = unifiedRef.current;
    const pieceTL = tlRef.current;
    const pieceTR = trRef.current;
    const pieceBL = blRef.current;
    const pieceBR = brRef.current;
    const appElement = document.querySelector<HTMLElement>(".app");

    if (
      !legacyView ||
      !scrim ||
      !construction ||
      !brandWordmark ||
      !unifiedLogo ||
      !pieceTL ||
      !pieceTR ||
      !pieceBL ||
      !pieceBR
    )
      return;

    if (stageRef.current) stageRef.current.style.display = "block";
    legacyView.style.display = "block";
    scrim.style.display = "block";

    // Set up the rising OPAC page surface (starts 100% at bottom, scaled, clipped)
    if (appElement) {
      appElement.classList.add("opac-page-surface");
      appElement.classList.remove("opac-page-revealed");
      gsap.set(appElement, {
        scale: 0.965,
        yPercent: 100,
        clipPath: "inset(9%)",
        opacity: 1,
        force3D: true,
      });
      // Temporarily hide the navbar brand so it doesn't double-overlap with the floating lockup
      const brandInNav = appElement.querySelector<HTMLElement>(".brand");
      if (brandInNav) {
        gsap.set(brandInNav, { autoAlpha: 0 });
      }
    }

    // Generate procedural noise texture for each piece canvas (PRNG seed 2135587861 from ReactDrops)
    document.querySelectorAll<HTMLCanvasElement>(".opac-noise-mask").forEach((canvas) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imgData = ctx.createImageData(canvas.width, canvas.height);
      let r = 2135587861;
      const prng = () => {
        r = (r * 1664525 + 1013904223) >>> 0;
        return r / 4294967296;
      };
      for (let i = 0; i < imgData.data.length; i += 4) {
        const val = Math.floor(prng() * 256);
        imgData.data[i] = val;
        imgData.data[i + 1] = val;
        imgData.data[i + 2] = val;
        imgData.data[i + 3] = 105 + Math.floor(prng() * 120);
      }
      ctx.putImageData(imgData, 0, 0);
    });

    const u = window.innerWidth;
    const d = window.innerHeight;
    const p = 16 * 22.5;
    const m = Math.min(p, u * 0.72, d * 0.9);
    const j = 0.12236;
    const M = (Math.hypot(u, d) / j) * 1.15;

    // Logo size: 422x220 -> aspect ratio 1.918. Upright, prominent & centered.
    const totalLogoW = Math.max(220, Math.min(320, m * 0.52));
    const totalLogoH = totalLogoW * (220 / 422);
    const partW = totalLogoW / 2;
    const partH = totalLogoH / 2;

    construction.style.setProperty("--part-w", `${partW}px`);
    construction.style.setProperty("--part-h", `${partH}px`);

    // Architectural separation distance for the 4 quadrants along the crosshairs
    const gapX = Math.round(partW * 0.42);
    const gapY = Math.round(partH * 0.42);

    // Font size for wordmark "moon"
    const wordmarkFontSize = Math.round(totalLogoH * 0.88);
    gsap.set(brandWordmark, { fontSize: wordmarkFontSize });

    const getWordWidth = (text: string) => {
      brandWordmark.textContent = text;
      return brandWordmark.getBoundingClientRect().width;
    };

    // Sequential typing for "moon": m -> mo -> moo -> moon
    const step1 = "m";
    const step2 = "mo";
    const step3 = "moo";
    const step4 = "moon";

    const F = getWordWidth(step1);
    const I = getWordWidth(step2);
    const L = getWordWidth(step3);
    const R = getWordWidth(step4);

    const B = Math.min(Math.max(20, totalLogoW * 0.16), 36);
    const V = totalLogoW + B + R;
    const H = -(B + R) / 2;
    const U = -V / 2 + totalLogoW + B;
    const W = (totalLogoW + B - F) / 2;
    const G = (totalLogoW + B - I) / 2;
    const ee = (totalLogoW + B - L) / 2;
    const K = totalLogoW / 2 + B;
    const q = -(B + F) / 2;
    const J = -(B + I) / 2;
    const Y = -(B + L) / 2;

    // Reset initial states
    gsap.set(construction, {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      autoAlpha: 1,
    });
    gsap.set(legacyView, { yPercent: 0, display: "block", autoAlpha: 1 });
    gsap.set(scrim, { autoAlpha: 0 });

    brandWordmark.textContent = step1;
    gsap.set(brandWordmark, {
      autoAlpha: 0,
      clipPath: "none",
      width: "auto",
      x: K,
      y: 0,
      yPercent: -50,
      scale: 1,
      filter: "brightness(1) contrast(1.08) saturate(0.72)",
    });

    const oe = { progress: 0 };

    // The Exact ReactDrops Page Reveal Math
    const updatePageReveal = () => {
      const eVal = oe.progress;
      const tVal = 1 - Math.pow(1 - Math.min(1, eVal / 0.68), 3);
      const rScale = eVal * 0.15 + Math.pow(eVal, 3) * 0.85;
      const inset = 9 * (1 - eVal);
      const aVal = 1 - Math.pow(1 - eVal, 2);

      // The OPAC Page Surface slides up from bottom (yPercent: 100 -> 0), scales up, and unmasks!
      if (appElement) {
        gsap.set(appElement, {
          yPercent: 100 * (1 - tVal),
          scale: 0.965 + rScale * 0.035,
          clipPath: `inset(${inset}%)`,
        });
      }

      // The preloader white background canvas drifts upward by -24%
      if (legacyView) {
        gsap.set(legacyView, {
          yPercent: -24 * aVal,
        });
      }
    };

    // Exact Custom Eases from ReactDrops Reference
    const entryDrift = CustomEase.create("entryDrift", "M0,0 C0.3,0.9 0.1,1 1,1");
    const nextPageEase = CustomEase.create("nextPageEase", "M0,0 C0.504,0.144 0.15,0.91 1,1");
    const ge = gsap.parseEase("power2.out");
    const Vc = (val: number) => val * val;

    // Initial 4 logo pieces: start assembled in center at (0, 0) with scale 0.01
    gsap.set([pieceTL, pieceTR, pieceBL, pieceBR], {
      x: 0,
      y: 0,
      scale: 0.01,
      autoAlpha: 1,
      force3D: true,
    });
    gsap.set(unifiedLogo, { autoAlpha: 0, filter: "brightness(1)" });

    // Construction hairline guides start collapsed
    gsap.set(".opac-line-horizontal", { xPercent: -50, x: 0, scaleX: 0, y: 0, width: "100vw", autoAlpha: 1 });
    gsap.set(".opac-line-vertical", { yPercent: -50, y: 0, scaleY: 0, x: 0, height: "100vh", autoAlpha: 1 });

    // Exact Timings from ReactDrops Source Code
    const ye = 0.87;
    const be = 0.88 * ye;
    const xe = 0.7 * ye;
    const Se = 1.08;
    const Ce = be * 0.75;
    const we = 0.733 * xe * Se;
    const Te = 0.092 * xe * Se;
    const De = 1.15 * xe;
    const Oe = Ce + 1.867 * xe * 0.4;
    const ke = 1.15 * xe;
    const Ae = Oe;
    const je = ke * 0.2;
    const Me = Ae + je;
    const Ne = Ae + je * 2;
    const Pe = Ae + je * 3;
    const Fe = Pe + ke * 0.55;
    const Ie = 2.2 * 1.33 * 1.04 * 0.95 * 0.97 * xe;
    const Le = Ie * 0.86 * 1.08;
    const Re = Le * 0.3 * 1.18;
    const ze = Re * 0.52;
    const Be = Re * 0.72;
    const Ve = Re * 0.38;
    const He = Re * 0.64;
    const Ue = 2.9447042118389186;
    const We = Ue + ze * 0.4;
    const Ge = We + Be * 0.15;
    const Ke = Ge + Ve * 0.15;
    const qe = We + Be * 0.2;
    const Je = 1.3;
    const Ye = qe + 2.1143807999999993 * 0.31 * ye;
    const Xe = 1.1;

    const ve = gsap.timeline({ paused: true });
    timelineRef.current = ve;

    // Timeline Phase 1: Logo springs into center (0.0s - 0.77s)
    ve.to([pieceTL, pieceTR, pieceBL, pieceBR], { scale: 1, duration: be, ease: ge, force3D: true }, 0)

      // Timeline Phase 2: Hairline construction lines sweep across the crosshairs at Ce
      .to(".line-top, .guide-inner-top, .guide-inner-bottom", { scaleX: 1, duration: we, ease: entryDrift }, Ce)
      .to(".line-right, .guide-inner-left, .guide-inner-right", { scaleY: 1, duration: we, ease: entryDrift }, Ce + Te)
      .to(".line-bottom", { scaleX: 1, duration: we, ease: entryDrift }, Ce + Te * 2)
      .to(".line-left", { scaleY: 1, duration: we, ease: entryDrift }, Ce + Te * 3)

      // Timeline Phase 3: Exact Staggered Cadence of the 4 Logo Quadrants Opening
      // Step 1 at Oe: Bottom-Left quadrant shifts outward
      .to(pieceBL, { x: -gapX, y: gapY, duration: De, ease: entryDrift, force3D: true }, Oe)
      .to(".line-bottom", { y: gapY, duration: De, ease: entryDrift }, Oe)
      .to(".line-left", { x: -gapX, duration: De, ease: entryDrift }, Oe)
      .to(".guide-inner-bottom", { y: Math.round(gapY * 0.5), duration: De, ease: entryDrift }, Oe)
      .to(".guide-inner-left", { x: -Math.round(gapX * 0.5), duration: De, ease: entryDrift }, Oe)

      // Step 2 at Me: Top-Left quadrant unfolds outward
      .to(pieceTL, { x: -gapX, y: -gapY, duration: ke, ease: entryDrift, force3D: true }, Me)
      .to(".line-top", { y: -gapY, duration: ke, ease: entryDrift }, Me)
      .to(".guide-inner-top", { y: -Math.round(gapY * 0.5), duration: De, ease: entryDrift }, Me)

      // Step 3 at Ne: Bottom-Right quadrant unfolds outward
      .to(pieceBR, { x: gapX, y: gapY, duration: ke, ease: entryDrift, force3D: true }, Ne)
      .to(".line-right", { x: gapX, duration: ke, ease: entryDrift }, Ne)
      .to(".guide-inner-right", { x: Math.round(gapX * 0.5), duration: De, ease: entryDrift }, Ne)

      // Step 4 at Pe: Top-Right quadrant unfolds outward
      .to(pieceTR, { x: gapX, y: -gapY, duration: ke, ease: entryDrift, force3D: true }, Pe)

      // Timeline Phase 4 at Fe (1.65s): The 4 quadrants pull smoothly together into the unified logo!
      .set(".opac-line-horizontal", { width: M }, Fe)
      .set(".opac-line-vertical", { height: M }, Fe)
      .to(
        [pieceTL, pieceTR, pieceBL, pieceBR],
        {
          x: 0,
          y: 0,
          duration: Le,
          ease: entryDrift,
          force3D: true,
        },
        Fe
      )
      .to(".line-top, .line-bottom, .guide-inner-top, .guide-inner-bottom", { y: 0, duration: Le, ease: entryDrift }, Fe)
      .to(".line-left, .line-right, .guide-inner-left, .guide-inner-right", { x: 0, duration: Le, ease: entryDrift }, Fe)

      // Cross-fade seamlessly into unified full logo container right as pieces touch
      .to(unifiedLogo, { autoAlpha: 1, duration: 0.18, ease: "power1.inOut" }, Fe + Le * 0.85)
      .to([pieceTL, pieceTR, pieceBL, pieceBR], { autoAlpha: 0, duration: 0.18, ease: "power1.inOut" }, Fe + Le * 0.85)

      // Blueprint lines dissolve
      .to(
        ".opac-construction-line",
        {
          autoAlpha: 0,
          duration: Ie * 0.82,
          ease: entryDrift,
        },
        Fe + Ie * 0.26
      )

      // Timeline Phase 5: Sequential Wordmark "moon" typing beside the reunited logo (Ue = 2.94s)
      .set(brandWordmark, { autoAlpha: 1 }, Ue)
      .to(brandWordmark, { x: W, duration: ze, ease: entryDrift }, Ue)
      .to(construction, { x: q, duration: ze, ease: entryDrift }, Ue)

      .call(() => {
        brandWordmark.textContent = step2;
      }, undefined, We)
      .to(brandWordmark, { x: G, duration: Be, ease: entryDrift }, We)
      .to(construction, { x: J, duration: Be, ease: entryDrift }, We)

      .call(() => {
        brandWordmark.textContent = step3;
      }, undefined, Ge)
      .to(brandWordmark, { x: ee, duration: Ve, ease: "power3.out" }, Ge)
      .to(construction, { x: Y, duration: Ve, ease: "power3.out" }, Ge)

      .call(() => {
        brandWordmark.textContent = step4;
      }, undefined, Ke)
      .to(brandWordmark, { x: U, duration: He, ease: "power2.out" }, Ke)
      .to(construction, { x: H, duration: He, ease: "power2.out" }, Ke)

      // Contrast/brightness shift into deep ink
      .to(
        brandWordmark,
        {
          filter: "brightness(0) contrast(1.08) saturate(0.72)",
          duration: Je,
          ease: Vc,
        },
        qe
      )
      .to(
        unifiedLogo,
        {
          filter: "brightness(0) contrast(1.08) saturate(0.72)",
          duration: Je,
          ease: Vc,
        },
        qe
      )

      // Timeline Phase 6: Smooth Transform into Page Surface & Upward Motion (Ye = 3.65s)
      .to(scrim, { autoAlpha: 1, duration: Xe * 0.35, ease: "expo.out" }, Ye);

    // DYNAMIC DOCKING TARGET: ENGLISH (UP-LEFT) vs ARABIC (UP-RIGHT)
    const isArabic = opacLang() === "ar";

    // Container width in OPAC is capped at 1240px and centered on screen
    const maxContainerW = Math.min(u - 40, 1240);
    const containerLeft = (u - maxContainerW) / 2;
    const containerRight = (u + maxContainerW) / 2;

    // In Arabic (RTL): entire lockup glides UP and to the TOP RIGHT
    // In English (LTR): entire lockup glides UP and to the TOP LEFT
    // Lockup retains its natural [logo] [moon] pairing seamlessly
    const targetCenterX = isArabic ? containerRight - 108 : containerLeft + 46;
    const targetCenterY = 46; // Topbar vertical center (~46px from top of viewport)

    // Relative to viewport center (u/2, d/2):
    // targetY is ALWAYS strictly negative so the motion is ALWAYS UP!
    const targetX = Math.round(targetCenterX - u / 2);
    const targetY = Math.round(targetCenterY - d / 2);
    const targetScale = 0.25;

    // Wordmark "moon" travels alongside the logo at its right side:
    const wordmarkTargetX = targetX + 58;
    const wordmarkTargetY = targetY;

    // BOTH THE LOGO AND THE WORDMARK GLIDE UP TOGETHER!
    // (Up and Left for English, Up and Right for Arabic)
    ve.to(
      construction,
      {
        x: targetX,
        y: targetY,
        scale: targetScale,
        duration: Xe,
        ease: nextPageEase,
        force3D: true,
      },
      Ye
    ).to(
      brandWordmark,
      {
        x: wordmarkTargetX,
        y: wordmarkTargetY,
        scale: targetScale,
        duration: Xe,
        ease: nextPageEase,
        force3D: true,
      },
      Ye
    );

    const brandBtn = appElement?.querySelector<HTMLElement>(".brand");

    // Seamless handoff to navbar brand as the lockup lands in place
    if (brandBtn) {
      ve.to(
        brandBtn,
        {
          autoAlpha: 1,
          duration: 0.22,
          ease: "power2.out",
        },
        Ye + Xe * 0.85
      );
    }

    // Fade out preloader floating lockup right as navbar brand reveals
    ve.to(
      [construction, brandWordmark],
      {
        autoAlpha: 0,
        duration: 0.2,
        ease: "power2.inOut",
      },
      Ye + Xe * 0.88
    );

    // Page unmasks with the exact ReactDrops cubic formula and rises from the bottom
    ve.to(oe, { progress: 1, duration: Xe, ease: nextPageEase, onUpdate: updatePageReveal }, Ye)
      .call(() => {
        finishAndDismiss();
      }, undefined, Ye + Xe);

    ve.play(0);
  }, [finishAndDismiss]);

  useEffect(() => {
    runAnimation();

    const handleReplay = () => {
      setIsDismissed(false);
      runAnimation();
    };

    window.addEventListener("moon-replay-entrance", handleReplay);

    return () => {
      window.removeEventListener("moon-replay-entrance", handleReplay);
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [runAnimation]);

  return (
    <>
      {/* 1. Preloader White Background Canvas (z-index: 1, sits below rising page) */}
      <div
        ref={legacyRef}
        className="opac-preloader-legacy"
        aria-hidden="true"
        onClick={finishAndDismiss}
      />

      {/* 2. Page Reveal Scrim (z-index: 4, between white canvas and rising page) */}
      <div ref={scrimRef} className="opac-preloader-scrim" aria-hidden="true" />

      {/* 3. Floating Animated Lockup (z-index: 30, visibly glides UP-RIGHT on top of rising page!) */}
      <div ref={stageRef} className="opac-preloader-stage" aria-hidden="true">
        <div ref={constructionRef} className="opac-preloader-construction">
          {/* Hairline guide lines (All 8 exact lines from ReactDrops) */}
          <div className="opac-construction-line opac-line-horizontal line-top" />
          <div className="opac-construction-line opac-line-horizontal line-bottom" />
          <div className="opac-construction-line opac-line-vertical line-left" />
          <div className="opac-construction-line opac-line-vertical line-right" />
          <div className="opac-construction-line opac-line-horizontal split-guide guide-inner-top" />
          <div className="opac-construction-line opac-line-horizontal split-guide guide-inner-bottom" />
          <div className="opac-construction-line opac-line-vertical split-guide guide-inner-left" />
          <div className="opac-construction-line opac-line-vertical split-guide guide-inner-right" />

          {/* 4 QUADRANTS OF JÖÖ MOON LOGO REPLACING THE 4 SQUARES */}
          <div ref={tlRef} className="opac-logo-piece piece-tl">
            <div className="opac-gradient-field" />
            <canvas className="opac-noise-mask" width={128} height={128} />
          </div>

          <div ref={trRef} className="opac-logo-piece piece-tr">
            <div className="opac-gradient-field" />
            <canvas className="opac-noise-mask" width={128} height={128} />
          </div>

          <div ref={blRef} className="opac-logo-piece piece-bl">
            <div className="opac-gradient-field" />
            <canvas className="opac-noise-mask" width={128} height={128} />
          </div>

          <div ref={brRef} className="opac-logo-piece piece-br">
            <div className="opac-gradient-field" />
            <canvas className="opac-noise-mask" width={128} height={128} />
          </div>

          {/* Unified Upright Logo seamlessly formed at Fe */}
          <div ref={unifiedRef} className="opac-unified-logo">
            <div className="opac-gradient-field" />
            <canvas className="opac-noise-mask" width={128} height={128} />
          </div>
        </div>

        {/* Wordmark "moon" typing sequentially */}
        <span ref={wordmarkRef} className="opac-brand-wordmark">
          moon
        </span>
      </div>
    </>
  );
};
