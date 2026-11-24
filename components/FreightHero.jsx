import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { homeFor } from '../utils/helpers';

const VIDEO_1080 = 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/409763c0-95f4-49d3-a601-dc564d55072b.mp4';
const VIDEO_720 = 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/b3718419-7a0a-478d-bfb0-0ff8bef7f3f7.mp4';
const POSTER = 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/2307e4bf-be39-42b4-b579-e168aeccabf0.jpg';

export default function FreightHero() {
  const { user } = useApp();
  const nav = useNavigate();
  const trackRef = useRef(null);
  const videoRef = useRef(null);
  const giantLettersRef = useRef(null);
  const speedReadoutRef = useRef(null);
  const stripRef = useRef(null);
  const progressFillRef = useRef(null);
  const containerStencilRef = useRef(null);

  const [progressPct, setProgressPct] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const authTarget = user ? homeFor(user.role) : '/login';
  const authTargetRef = useRef(authTarget);
  authTargetRef.current = authTarget;

  useEffect(() => {
    // Reset to top on entry
    window.scrollTo(0, 0);

    const video = videoRef.current;
    const track = trackRef.current;
    const giantLetters = giantLettersRef.current;
    const speedReadout = speedReadoutRef.current;
    const strip = stripRef.current;
    const progressFill = progressFillRef.current;
    const containerStencil = containerStencilRef.current;
    if (!video || !track || !giantLetters || !strip || !speedReadout) return;

    let animId;
    const A = 2.4;
    let B = 2.0;
    let duration = 4.04;
    let curTime = 0;
    let targetTime = 0;
    let lastScrollY = window.scrollY;
    let lastTime = performance.now();
    let smoothSpeed = 0;
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let edgePx = 0.448 * vh;
    let isSeeking = false;
    let pendingSeek = null;

    // Automatic animation progress: starts immediately upon entry
    let autoPlayProgress = 0;
    const autoPlayDuration = 7200; // 7.2s smooth cinematic intro
    let hasTriggeredNav = false;

    // Direct video setup
    const initialSrc = vw <= 900 ? VIDEO_720 : VIDEO_1080;
    video.src = initialSrc;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.load();

    // Preload into memory for 60fps instant seeking
    fetch(initialSrc)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        video.src = blobUrl;
        video.load();
      })
      .catch(() => {});

    const onMeta = () => {
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        duration = video.duration;
      }
      layout();
    };
    video.addEventListener('loadedmetadata', onMeta);

    function doSeek(t) {
      if (video.readyState < 1) return;
      if (isSeeking) {
        pendingSeek = t;
        return;
      }
      isSeeking = true;
      try {
        if ('fastSeek' in video) {
          video.fastSeek(t);
        } else {
          video.currentTime = t;
        }
      } catch (e) {
        video.currentTime = t;
      }
    }

    const onSeeked = () => {
      isSeeking = false;
      if (pendingSeek !== null) {
        const next = pendingSeek;
        pendingSeek = null;
        doSeek(next);
      }
    };
    video.addEventListener('seeked', onSeeked);

    function layout() {
      vw = window.innerWidth;
      vh = window.innerHeight;
      const isNarrow = vw <= 768 || vw <= vh;

      if (isNarrow) {
        const videoWidth = 1.55 * vw;
        const videoHeight = videoWidth * (1080 / 1920);
        const videoLeft = vw * 0.5 - 0.40 * videoWidth;
        const videoTop = 0.36 * vh - 0.448 * videoHeight;
        edgePx = 0.36 * vh;

        video.style.width = `${videoWidth}px`;
        video.style.height = `${videoHeight}px`;
        video.style.left = `${videoLeft}px`;
        video.style.top = `${videoTop}px`;
      } else {
        const scale = Math.max(vw / 1920, vh / 1080);
        const videoWidth = 1920 * scale;
        const videoHeight = 1080 * scale;
        const videoLeft = (vw - videoWidth) / 2;
        const videoTop = (vh - videoHeight) / 2;
        edgePx = videoTop + 0.448 * videoHeight;

        video.style.width = `${videoWidth}px`;
        video.style.height = `${videoHeight}px`;
        video.style.left = `${videoLeft}px`;
        video.style.top = `${videoTop}px`;
      }

      document.documentElement.style.setProperty('--edge-px', `${edgePx}px`);

      const stripWidth = strip.scrollWidth;
      B = ((stripWidth + 0.45 * vw) / vw) * 1.1;
      const totalHeight = (1 + A + B) * vh;
      track.style.height = `${totalHeight}px`;
    }

    window.addEventListener('resize', layout);
    layout();
    const tId = setTimeout(layout, 350);

    function updateCardReveals() {
      const cards = strip.querySelectorAll('.hero-card');
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const cardLeft = rect.left;
        const s = Math.min(1.6, Math.max(-0.4, (0.98 - cardLeft / vw) / 0.3)) * 100;
        const s1 = Math.round(s - 34);
        const s2 = Math.round(s - 6);
        const s3 = Math.round(s + 26);
        const grad = `linear-gradient(90deg, #ffffff ${s1}%, #2f63ff ${s2}%, transparent ${s3}%)`;
        const title = card.querySelector('.hero-card-title');
        const body = card.querySelector('.hero-card-body');
        if (title) title.style.backgroundImage = grad;
        if (body) body.style.backgroundImage = grad;
      });
    }

    function tick(now) {
      const dt = Math.max(1, now - lastTime);
      lastTime = now;

      const totalScroll = Math.max(1, (1 + A + B) * vh - vh);

      // AUTOMATIC PROGRESS: drives the animation automatically upon entry without any button click
      autoPlayProgress += dt / autoPlayDuration;

      if (autoPlayProgress >= 1) {
        autoPlayProgress = 1;
        window.scrollTo(0, totalScroll);

        // When animation ends, transition immediately to login page
        if (!hasTriggeredNav) {
          hasTriggeredNav = true;
          setIsNavigating(true);
          setTimeout(() => {
            nav(authTargetRef.current);
          }, 450);
        }
      } else {
        window.scrollTo(0, autoPlayProgress * totalScroll);
      }

      const sy = window.scrollY;
      const dy = Math.abs(sy - lastScrollY);
      lastScrollY = sy;

      const rawSpeed = Math.min(99, (dy / (dt / 1000)) / 32);
      smoothSpeed += (rawSpeed - smoothSpeed) * 0.15;
      const displaySpeed = String(Math.min(99, Math.round(smoothSpeed))).padStart(2, '0');
      speedReadout.textContent = `${displaySpeed} KM/H`;

      // Scrubbing calculation
      const q = Math.min(1, Math.max(0, sy / (A * vh)));
      targetTime = q * Math.max(0, duration - 1 / 48);
      curTime += (targetTime - curTime) * 0.35;

      if (Math.abs(curTime - video.currentTime) > 1 / 60) {
        doSeek(curTime);
      }

      const ph = q >= 0.94 ? 1 : 0;
      document.documentElement.style.setProperty('--ph', ph);

      const r = Math.min(1, Math.max(0, (sy - A * vh) / (B * vh)));
      const stripWidth = strip.scrollWidth;
      const stripTranslateX = vw - r * (stripWidth + 0.45 * vw);
      strip.style.transform = `translateX(${stripTranslateX}px)`;

      const lettersWidth = giantLetters.scrollWidth;
      const lettersTranslateX = vw - r * (lettersWidth + vw);
      giantLetters.style.transform = `translateX(${lettersTranslateX}px)`;

      // Progress bar fill
      const currentProgress = Math.min(1, Math.max(0, sy / totalScroll));
      if (progressFill) {
        progressFill.style.width = `${(currentProgress * 100).toFixed(1)}%`;
      }
      setProgressPct(Math.round(currentProgress * 100));

      // Container company name stencil visibility
      if (containerStencil) {
        const stencilOpacity = q >= 0.15 ? Math.min(1, (q - 0.15) / 0.2) : 0;
        containerStencil.style.opacity = String(stencilOpacity);
      }

      // Trigger transition to login page if user also reached the end
      if (currentProgress >= 0.985 && !hasTriggeredNav) {
        hasTriggeredNav = true;
        setIsNavigating(true);
        setTimeout(() => {
          nav(authTargetRef.current);
        }, 450);
      }

      updateCardReveals();

      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(tId);
      window.removeEventListener('resize', layout);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [nav]);

  const handleProgressBarClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, clickX / rect.width));
    const A = 2.4;
    const B = 2.0;
    const vh = window.innerHeight;
    const totalScroll = (1 + A + B) * vh - vh;
    window.scrollTo({ top: ratio * totalScroll, behavior: 'smooth' });
  };

  return (
    <div className="track" ref={trackRef}>
      {/* Top Progress Bar */}
      <div className="fh-progress-bar" onClick={handleProgressBarClick} title="Intro Progress">
        <div className="fh-progress-fill" ref={progressFillRef} />
      </div>

      {/* Nav */}
      <header className="fh-nav">
        <Link to="/" className="fh-brand">Trackora</Link>
        <div className="fh-nav-links">
          <Link to={authTarget} className="fh-nav-pill">
            Skip to Login →
          </Link>
        </div>
      </header>

      {/* Sticky Scene */}
      <div className="fh-scene">
        {/* Auto-Scrubbed Video */}
        <video
          ref={videoRef}
          className="fh-video"
          muted
          playsInline
          preload="auto"
          poster={POSTER}
        />

        {/* Giant Letters */}
        <div className="fh-giant-letters" ref={giantLettersRef}>OUR SERVICES</div>

        {/* Speed Readout & Telemetry Badge */}
        <div className="fh-telemetry-panel">
          <div className="fh-speed-readout" ref={speedReadoutRef}>00 KM/H</div>
          <div className="fh-anim-indicator">
            <span className="fh-pulse-dot active" />
            <small>Intro Playing · {progressPct}%</small>
          </div>
        </div>

        {/* Company Name Stencil on Navy Container */}
        <div className="fh-container-stencil" ref={containerStencilRef}>
          <div className="fh-stencil-brand">TRACKORA</div>
        </div>

        {/* Bottom Skip Pill */}
        <div className="fh-scroll-hint">
          <Link to={authTarget} className="fh-skip-button">
            Skip Intro →
          </Link>
        </div>

        {/* Dark Ground Band */}
        <div className="fh-band">
          <div className="fh-strip" ref={stripRef}>
            {/* Lead Block */}
            <div className="fh-lead-block">
              <div className="fh-lead-headline">
                EVERYTHING YOUR<br />FREIGHT NEEDS.<br /><span className="fh-cobalt">UNDER ONE GROUP.</span>
              </div>
              <div className="fh-lead-paragraphs">
                <p>From air to sea, from customs clearance to the last mile, we bring decades of practice to every freight discipline.</p>
                <p>One integrated network means one partner, one point of contact and full visibility from origin to destination.</p>
              </div>
            </div>

            {/* 5 Cards */}
            <div className="hero-card">
              <div className="hero-card-icon">
                <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </div>
              <div className="hero-card-title">AIR<br />FREIGHT</div>
              <div className="hero-card-body">Express, priority and deferred options across global lanes, booked and tracked end to end.</div>
            </div>

            <div className="hero-card">
              <div className="hero-card-icon">
                <svg viewBox="0 0 24 24"><path d="M3 18l3 3h12l3-3M2 13h20M5 13l2-6h10l2 6M12 3v4"/></svg>
              </div>
              <div className="hero-card-title">OCEAN<br />FREIGHT</div>
              <div className="hero-card-body">FCL and LCL sailings on every major trade lane, with carrier choice based on cost and transit time.</div>
            </div>

            <div className="hero-card">
              <div className="hero-card-icon">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>
              </div>
              <div className="hero-card-title">CUSTOMS<br />BROKERAGE</div>
              <div className="hero-card-body">Licensed in-house brokers for classification, duties and inspections, so goods clear first time.</div>
            </div>

            <div className="hero-card">
              <div className="hero-card-icon">
                <svg viewBox="0 0 24 24"><path d="M3 21h18M3 10l9-7 9 7v11H3V10zM9 21v-8h6v8"/></svg>
              </div>
              <div className="hero-card-title">WAREHOUSING<br />AND 3PL</div>
              <div className="hero-card-body">Bonded and general storage, pick and pack, and distribution that plugs straight into transport.</div>
            </div>

            <div className="hero-card">
              <div className="hero-card-icon">
                <svg viewBox="0 0 24 24"><path d="M4 22h16M7 22V4l13 4M13 6v10a3 3 0 0 1-6 0M8 19h4"/></svg>
              </div>
              <div className="hero-card-title">PROJECT<br />CARGO</div>
              <div className="hero-card-body">Oversized and heavy-lift moves, engineered, permitted and escorted from factory to foundation.</div>
            </div>
          </div>

          {/* Bottom Pill */}
          <Link to={authTarget} className="fh-band-pill">
            Opening Trackora Login →
          </Link>
        </div>
      </div>

      {/* Transition Modal when Animation Ends */}
      {isNavigating && (
        <div className="fh-nav-overlay">
          <div className="fh-nav-modal">
            <span className="fh-nav-spinner" />
            <div className="fh-nav-badge">Story Complete</div>
            <h3>Entering Trackora</h3>
            <p>Opening login & tracking console...</p>
          </div>
        </div>
      )}
    </div>
  );
}
