import styles from './TermsPage.module.css'

export default function TermsPage() {
  const goHome = () => { window.location.href = '/' }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navLogo} onClick={goHome} style={{ cursor: 'pointer' }}>
          <span>🧭</span> NAVIGATOR AI
        </div>
        <button className={styles.navBack} onClick={goHome}>← Back to Home</button>
      </nav>

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.eyebrow}>LEGAL</div>
            <h1 className={styles.title}>Terms of Service & Risk Disclaimer</h1>
            <p className={styles.meta}>Last Updated: 8 June 2026 &nbsp;·&nbsp; Innocent Traders · South Africa</p>
          </div>

          <div className={styles.content}>

            <section className={styles.section}>
              <h2>1. The Service Provided</h2>
              <p>1.1. Innocent Traders ("Software Provider", "we", "us") develops and sells NAVI-v3 AI Chart Analysis Tool ("the Software", "NAVI-v3").</p>
              <p>1.2. The Software is a technical utility that analyzes uploaded MT4/MT5 chart screenshots and outputs AI-generated technical observations. This includes identification of chart patterns, support/resistance levels, and market structure.</p>
              <p>1.3. The Software Provider does not manage client trading accounts, hold client funds, connect to broker APIs, or execute trades. The Software does not issue buy/sell recommendations, signals, or alerts.</p>
            </section>

            <section className={styles.section}>
              <h2>2. No Financial Services Provider Relationship</h2>
              <p>2.1. The Client acknowledges that the Software Provider is <strong>not</strong> a registered Financial Services Provider under the Financial Advisory and Intermediary Services Act of South Africa.</p>
              <p>2.2. The Software is an automated analytical tool intended purely for informational, educational, and technical assistance. All trading and investment decisions are made solely by the Client.</p>
              <p>2.3. Nothing on this website or within the Software constitutes financial, investment, tax, or trading advice.</p>
            </section>

            <section className={styles.section}>
              <h2>3. User Eligibility & Account Responsibility</h2>
              <p>3.1. You must be 18 years of age or older to purchase a license.</p>
              <p>3.2. You are responsible for maintaining the confidentiality of your account login and for all activity under your account.</p>
            </section>

            <section className={styles.section}>
              <h2>4. License Grant & Restrictions</h2>
              <p>4.1. Upon payment, we grant you a limited, non-exclusive, non-transferable license to use NAVI-v3 for personal use only.</p>
              <p>4.2. You may not resell, redistribute, reverse-engineer, or share your license.</p>
            </section>

            <section className={`${styles.section} ${styles.riskSection}`}>
              <h2>⚠️ 5. Risk Warning & No Guarantees</h2>
              <p>5.1. <strong>High-Risk Warning:</strong> Trading foreign exchange, derivatives, and financial markets carries a high level of risk and may not be suitable for all investors. You could lose some or all of your invested capital.</p>
              <p>5.2. <strong>No Guarantees:</strong> The Software Provider makes no promises, guarantees, or representations regarding potential profits, income, or trading success. Past performance of any market or analysis method does not guarantee future results.</p>
              <p>5.3. <strong>Assumption of Risk:</strong> The Client uses the Software entirely at their own risk. The Software Provider is not liable for any financial losses, account wipeouts, or damages resulting from the use of the Software or reliance on its output.</p>
            </section>

            <section className={styles.section}>
              <h2>6. Fees and Strict No-Refund Policy</h2>
              <p>6.1. All payments made for the Software, software licenses, or digital access are final.</p>
              <p>6.2. Due to the digital nature of software delivery and intellectual property, <strong>no refunds will be issued under any circumstances</strong>, including but not limited to: market losses, changes in the Client's financial situation, technical incompatibility, or buyer's remorse.</p>
              <p>6.3. Chargebacks initiated after accessing the Software will be contested with this agreement as evidence.</p>
            </section>

            <section className={styles.section}>
              <h2>7. Limitation of Liability</h2>
              <p>7.1. To the maximum extent permitted by law, Innocent Traders shall not be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use or inability to use the Software.</p>
            </section>

            <section className={styles.section}>
              <h2>8. Governing Law</h2>
              <p>8.1. This Agreement is governed by the laws of the Republic of South Africa. Any disputes will be handled through civil channels in South Africa.</p>
            </section>

            <section className={styles.section}>
              <h2>9. Acceptance of Terms</h2>
              <p>9.1. By purchasing, accessing, or using NAVI-v3, you confirm that you have read, understood, and accept all the terms, risk warnings, and the no-refund policy stated in this agreement.</p>
            </section>

            <div className={styles.contactBox}>
              <p><strong>Contact:</strong> Innocent Traders · South Africa</p>
              <p>For queries regarding these terms, reach out via the contact details provided at point of purchase.</p>
            </div>

          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerDisclaimer}>
          Chart analysis for educational purposes only. Not financial advice. Trading carries significant risk. Always manage your risk.
        </div>
        <div className={styles.footerCopy}>© 2026 Navigator AI · Innocent Traders · South Africa</div>
      </footer>
    </div>
  )
}
