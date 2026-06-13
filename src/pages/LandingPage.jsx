import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

const reviews = [
  { name: 'Thabo M.',     location: 'Johannesburg, SA', pair: 'EUR/USD', stars: 5, text: 'First scan gave me a clear pattern breakdown in seconds. The key levels identified were spot on — never going back to manual chart reading.' },
  { name: 'Kgomotso D.', location: 'Pretoria, SA',      pair: 'GBP/JPY', stars: 5, text: 'The AI identified a multi-timeframe confluence I completely missed. Incredibly useful for educational chart analysis.' },
  { name: 'Sipho N.',     location: 'Durban, SA',        pair: 'XAU/USD', stars: 5, text: 'Gold charts are my focus. Navigator AI spots key zones and pattern levels I sometimes miss after staring at charts for hours.' },
  { name: 'Lerato K.',    location: 'Cape Town, SA',     pair: 'USD/JPY', stars: 5, text: 'Started with the free trial and was impressed enough to keep using it. The annotated analysis makes it so easy to see why a level matters.' },
  { name: 'James R.',     location: 'London, UK',        pair: 'NAS100',  stars: 5, text: 'I analyse indices and the AI nails the key levels consistently. Seeing multiple pattern confirmations gives you real confidence.' },
  { name: 'Amahle Z.',    location: 'Bloemfontein, SA',  pair: 'EUR/GBP', stars: 5, text: 'My chart accuracy improved significantly in 3 weeks. The pattern analysis is precise — helps me understand structure much better.' },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>

      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.navLogoIcon}>🧭</div>
          <span className={styles.navLogoText}>NAVIGATOR <span className={styles.navLogoAi}>AI</span></span>
        </div>
        <div className={styles.navRight}>
          <button className={styles.navSignIn} onClick={() => navigate('/auth')}>Sign In</button>
          <button className={styles.navGetStarted} onClick={() => navigate('/auth')}>Get Started →</button>
        </div>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroEyebrow}>★★★★★ &nbsp; TRUSTED BY 500+ TRADERS</div>
        <h1 className={styles.heroTitle}>
          NAVIGATOR AI: Data Visualization &amp;<br />
          <span className={styles.heroGrad}>Pattern Analysis Software</span>
        </h1>
        <p className={styles.heroSub}>
          Upload any financial data chart — AI identifies <strong>key levels</strong>, <strong>pattern zones</strong>, <strong>support</strong> and <strong>resistance areas</strong> in seconds. Built for beginners. Trusted by pros.
        </p>
        <div className={styles.heroBtns}>
          <button className={styles.heroCta} onClick={() => navigate('/auth')}>Start Scanning Free →</button>
          <a
            className={styles.heroApk}
            href="https://appsgeyser.io/19721846/Navigator%20AI"
            target="_blank"
            rel="noreferrer"
          >
            📲 Download Android App
          </a>
        </div>
        <div className={styles.heroDisclaimer}>~Not financial advice &nbsp;·&nbsp; +AI-powered analysis &nbsp;·&nbsp; *You make the final call</div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.section}>
        <div className={styles.sectionEyebrow}>HOW IT WORKS</div>
        <h2 className={styles.sectionTitle}>Three steps. Ten seconds.</h2>
        <div className={styles.stepsGrid}>
          <div className={styles.stepCard}>
            <div className={styles.stepNum}>01</div>
            <div className={styles.stepIcon}>📸</div>
            <div className={styles.stepTitle}>You screenshot. AI reads.</div>
            <div className={styles.stepDesc}>Drop any chart — AI scans the structure, finds key levels, and maps out the full analysis for you.</div>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepNum}>02</div>
            <div className={styles.stepIcon}>🧠</div>
            <div className={styles.stepTitle}>No more guessing levels</div>
            <div className={styles.stepDesc}>Every scan returns key levels, pattern zones, and structural context. No gut feeling — just data-driven chart analysis.</div>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepNum}>03</div>
            <div className={styles.stepIcon}>🎯</div>
            <div className={styles.stepTitle}>See your pattern analysis</div>
            <div className={styles.stepDesc}>Key levels, invalidation zones, and projected targets — mapped out clearly in under 10 seconds.</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.section}>
        <div className={styles.sectionEyebrow}>FEATURES</div>
        <h2 className={styles.sectionTitle}>Everything you need to analyse charts smarter</h2>
        <div className={styles.featuresGrid}>
          <div className={`${styles.featureCard} ${styles.featureCyan}`}>
            <div className={styles.featureIcon}>⚡</div>
            <div className={styles.featureTitle}>Instant AI Analysis</div>
            <div className={styles.featureDesc}>Upload any financial data chart and get a full pattern breakdown in seconds. Compatible with charts from any platform.</div>
            <ul className={styles.featureList}>
              <li>Any pair, any timeframe</li>
              <li>Entry, SL & 3 TP levels</li>
              <li>Risk:Reward calculation</li>
            </ul>
          </div>
          <div className={`${styles.featureCard} ${styles.featureViolet}`}>
            <div className={styles.featureIcon}>📐</div>
            <div className={styles.featureTitle}>Smart Money Levels</div>
            <div className={styles.featureDesc}>AI detects support & resistance, order blocks, FVGs, and liquidity zones that matter most.</div>
            <ul className={styles.featureList}>
              <li>Support & Resistance</li>
              <li>Price action patterns</li>
              <li>Market sentiment score</li>
            </ul>
          </div>
          <div className={`${styles.featureCard} ${styles.featurePink}`}>
            <div className={styles.featureIcon}>🌐</div>
            <div className={styles.featureTitle}>For Every Trader</div>
            <div className={styles.featureDesc}>Whether you're just starting or already profitable — AI gives you a second pair of eyes on every setup.</div>
            <ul className={styles.featureList}>
              <li>Beginner friendly</li>
              <li>Works on any device</li>
              <li>No experience needed</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FOR EVERY TRADER */}
      <section className={styles.section}>
        <div className={styles.sectionEyebrow}>FOR EVERY TRADER</div>
        <h2 className={styles.sectionTitle}>We welcome everyone. Beginner or pro.</h2>
        <div className={styles.traderGrid}>
          {[
            { icon: '🌱', title: 'Just Starting Out',     desc: 'Never read a chart before? AI shows you exactly what a professional sees — support, resistance, key pattern zones — explained clearly.' },
            { icon: '🕐', title: 'Part-Time Users',       desc: 'Limited screen time? Get a full chart analysis in 10 seconds. No hours of chart study needed. Scan before work, review during lunch.' },
            { icon: '🔓', title: 'Independent Analysts',  desc: "Build your own conviction. AI gives you the educational chart analysis — the decision is always yours." },
            { icon: '🎯', title: 'Experienced Chartists', desc: "Already skilled at reading charts? Use AI as a second pair of eyes. Confirm your analysis, catch levels you might have missed." },
          ].map((t, i) => (
            <div key={i} className={styles.traderCard}>
              <div className={styles.traderIcon}>{t.icon}</div>
              <div className={styles.traderTitle}>{t.title}</div>
              <div className={styles.traderDesc}>{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* REVIEWS */}
      <section className={styles.section}>
        <div className={styles.sectionEyebrow}>TRADER REVIEWS</div>
        <h2 className={styles.sectionTitle}>What Users Are Saying</h2>
        <p className={styles.sectionSub}>Real feedback from real users of Navigator AI.</p>
        <div className={styles.reviewsGrid}>
          {reviews.map((r, i) => (
            <div key={i} className={styles.reviewCard}>
              <div className={styles.reviewStars}>{'★'.repeat(r.stars)}</div>
              <div className={styles.reviewText}>"{r.text}"</div>
              <div className={styles.reviewAuthor}>
                <div className={styles.reviewAvatar}>{r.name.charAt(0)}</div>
                <div>
                  <div className={styles.reviewName}>{r.name}</div>
                  <div className={styles.reviewMeta}>{r.location} · {r.pair}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.reviewsFooter}>★★★★★ &nbsp; 4.7/5 average from 500+ users</div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <div className={styles.ctaIcon}>🧭</div>
          <h2 className={styles.ctaTitle}>See what AI sees in your chart</h2>
          <p className={styles.ctaSub}>Upload any chart. Get AI-powered analysis with key levels, entry, SL & TP mapped in seconds.</p>
          <button className={styles.ctaBtn} onClick={() => navigate('/auth')}>Start Scanning Free →</button>
          <div className={styles.ctaFlags}>🇿🇦 🇳🇬 🇬🇧 🇰🇪 &nbsp; Used by chart analysts across Africa &amp; beyond</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <span>🧭</span> NAVIGATOR AI
        </div>
        <a
          className={styles.footerApk}
          href="https://appsgeyser.io/19721846/Navigator%20AI"
          target="_blank"
          rel="noreferrer"
        >
          📲 Download Android App
        </a>
        <div className={styles.footerDisclaimer}>
          NAVIGATOR AI is an educational software tool. No financial advice provided. Chart analysis for educational purposes only. Financial data charts carry significant risk — you may lose some or all of your capital. Always manage your risk.
        </div>
        <div className={styles.footerLinks}>
          <span onClick={() => { window.location.href = '/terms' }} className={styles.footerLink}>Terms of Service & Risk Disclaimer</span>
        </div>
        <div className={styles.footerCopy}>© 2026 Navigator AI · Innocent Traders · South Africa. All rights reserved.</div>
      </footer>

    </div>
  )
}
