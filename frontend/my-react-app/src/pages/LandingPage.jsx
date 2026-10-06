
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/arche-logo.png";

import img1 from "../assets/businessman-working-tablet-with-data-visualization.jpg";
import img2 from "../assets/futuristic-business-meeting-with-digital-table-cityscape-view.jpg";
import img3 from "../assets/team-working-together-project.jpg";

import "../styles/LandingPage.css";

const HERO_IMAGES = [img1, img2, img3];

function LandingPage() {
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setHeroImageIndex((prev) => (prev + 1) % HERO_IMAGES.length),
      5000
    );
    return () => clearInterval(id);
  }, []);

  const activeHeroImage = HERO_IMAGES[heroImageIndex];

  const heroAnimationClass =
    heroImageIndex % 2 === 0 ? "hero-image-zoom-in" : "hero-image-zoom-out";

  return (
    <div className="h-screen overflow-hidden bg-brandBg text-brandDark flex flex-col">
      { }
      <header className="flex items-center justify-between px-4 sm:px-8 py-2">
        <div className="flex items-center gap-2">
          <img
            src={logo}
            alt="RIDE.arche.global logo"
            className="h-10 sm:h-8 w-auto object-contain"
          />
        </div>
      </header>

      { }
      <main className="flex-1 px-4 sm:px-8 pb-4 flex flex-col lg:flex-row gap-4 lg:gap-6 items-center justify-center overflow-hidden">
        { }
        <section className="w-full lg:w-1/2 space-y-4 sm:space-y-5 max-w-xl">
          { }
          <p className="font-urbanist text-[3px] sm:text-xs tracking-[0.25em] uppercase text-brandMuted ridc-animate-once">
            Risk · Issue · Dependency · Escalation
          </p>

          { }
          <h1 className="font-marcellus font-bold text-3xl sm:text-4xl lg:text-5xl text-brandDark leading-tight fade-in-left-slow-main tracking-tight mb-1">
            Manage delivery
            <br className="hidden sm:block" />
            with clarity and control
          </h1>

          { }
          <p className="font-urbanist text-sm sm:text-base text-brandMuted max-w-xl fade-in-left-slower">
            Empowering teams to execute with precision, collaborate with purpose, and deliver with excellence across every project milestone.
          </p>

          { }
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center fade-in-left-ctas">
            <div className="flex gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full w-56 py-3 text-sm font-urbanist font-semibold shadow-sm border border-brandDark cta-animate"
              >
                Login
              </Link>
            </div>
          </div>
        </section>

        { }
        <section className="w-full lg:w-1/2 flex justify-center items-center">
          <div className="hero-image-wrapper">
            <img
              src={activeHeroImage}
              alt="Delivery visual"
              className={`hero-image-base ${heroAnimationClass}`}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
