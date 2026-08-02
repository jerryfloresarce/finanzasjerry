// Animaciones cinemáticas — GSAP + ScrollTrigger.
// Solo se aplican dentro del dashboard; los formularios y listados
// del resto de vistas son instantáneos a propósito.

let heroTriggers = [];
let revealTriggers = [];

function killTriggers(list) {
  list.forEach((t) => t.kill());
  list.length = 0;
}

export function initDashboardAnimations() {
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  killTriggers(heroTriggers);
  killTriggers(revealTriggers);

  const heroBg = document.getElementById("hero-bg");
  const heroContent = document.querySelector("#hero-parallax .hero__content");
  const hero = document.getElementById("hero-parallax");

  if (hero && heroBg) {
    const parallax = gsap.to(heroBg, {
      yPercent: 14,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
    heroTriggers.push(parallax.scrollTrigger);

    gsap.fromTo(
      heroBg,
      { scale: 1.12, opacity: 0.6 },
      { scale: 1.05, opacity: 1, duration: 1.4, ease: "power2.out" }
    );

    if (heroContent) {
      gsap.fromTo(
        heroContent,
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.1, ease: "power3.out", delay: 0.15 }
      );
    }
  }

  document.querySelectorAll("#view-dashboard .reveal").forEach((el, i) => {
    el.classList.remove("is-visible");
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay: (i % 3) * 0.06,
          ease: "power3.out",
        });
      },
    });
    revealTriggers.push(trigger);
  });

  ScrollTrigger.refresh();
}

export function refreshAnimations() {
  if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
}
