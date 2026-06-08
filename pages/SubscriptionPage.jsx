import styles from './SubscriptionPage.module.css'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    scans: 3,
    scanLabel: '3 scans total',
    features: [
      '3 lifetime scans',
      'Basic signal output',
      'Scanner tab only',
      'No alerts',
    ],
    cta: 'Current Plan',
    ctaDisabled: true,
    color: '#5a6370',
    accent: 'rgba(90,99,112,0.15)',
    border: 'rgba(90,99,112,0.25)',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$25',
    period: 'per purchase',
    scans: 20,
    scanLabel: '20 scans',
    features: [
      '20 scan credits',
      'Full AI analysis',
      'Multi-TF scanner',
      'Push alerts',
      'Watchlist',
    ],
    cta: 'Buy Standard',
    ctaDisabled: false,
    url: 'https://paystack.com/buy/app-scanner--standard--gxfshu',
    color: '#00bcd4',
    accent: 'rgba(0,188,212,0.08)',
    border: 'rgba(0,188,212,0.3)',
    badge: null,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$100',
    period: 'per month',
    scans: -1,
    scanLabel: 'Unlimited scans',
    features: [
      'Unlimited scans / month',
      'Full AI analysis',
      'Multi-TF scanner',
      'Push alerts',
      'Watchlist',
      'Priority support',
      'Early access to features',
    ],
    cta: 'Buy Premium',
    ctaDisabled: false,
    url: 'https://paystack.com/buy/app-scanner--premium--onvowo',
    color: '#00e676',
    accent: 'rgba(0,230,118,0.08)',
    border: 'rgba(0,230,118,0.35)',
    badge: 'BEST VALUE',
  },
]

export default function SubscriptionPage({ onBack, currentPlan = 'free', scansLeft = 0 }) {
  function handleBuy(url) {
    window.open(url, '_blank')
  }

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.headerTitle}>
          <span className={styles.logoMark}>◎</span>
          Navigator <span className={styles.ai}>AI</span>
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroEyebrow}>UPGRADE YOUR PLAN</div>
        <h1 className={styles.heroTitle}>Unlock Full Access</h1>
        <p className={styles.heroSub}>
          Real-time AI signals powered by live market data.
          Choose the plan that fits your trading style.
        </p>
      </div>

      {currentPlan === 'free' && (
        <div className={styles.statusBanner}>
          <span className={styles.statusDot} />
          Free plan · <strong>{scansLeft}</strong> scans remaining
        </div>
      )}
      {currentPlan === 'standard' && (
        <div className={styles.statusBannerStandard}>
          <span className={styles.statusDotCyan} />
          Standard plan · <strong>{scansLeft}</strong> scans remaining
        </div>
      )}
      {currentPlan === 'premium' && (
        <div className={styles.statusBannerPremium}>
          <span className={styles.statusDotGreen} />
          Premium plan · Unlimited scans active
        </div>
      )}

      <div className={styles.plans}>
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={styles.planCard}
            style={{
              borderColor: currentPlan === plan.id ? plan.color : plan.border,
              background: currentPlan === plan.id ? plan.accent : 'var(--card)',
            }}
          >
            {plan.badge && (
              <div className={styles.badge} style={{ background: plan.color, color: '#000' }}>
                {plan.badge}
              </div>
            )}
            {currentPlan === plan.id && (
              <div className={styles.activeBadge}>ACTIVE</div>
            )}

            <div className={styles.planHeader}>
              <div className={styles.planName} style={{ color: plan.color }}>{plan.name}</div>
              <div className={styles.planPrice}>{plan.price}</div>
              <div className={styles.planPeriod}>{plan.period}</div>
            </div>

            <div className={styles.scanCount} style={{ color: plan.color, borderColor: plan.border }}>
              {plan.scans === -1 ? '∞' : plan.scans}
              <span className={styles.scanCountLabel}>{plan.scanLabel}</span>
            </div>

            <ul className={styles.features}>
              {plan.features.map(f => (
                <li key={f} className={styles.feature}>
                  <span className={styles.featureCheck} style={{ color: plan.color }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              className={styles.ctaBtn}
              style={{
                background: plan.ctaDisabled ? 'rgba(255,255,255,0.05)' : plan.color,
                color: plan.ctaDisabled ? '#5a6370' : '#000',
                cursor: plan.ctaDisabled ? 'default' : 'pointer',
                borderColor: plan.border,
              }}
              disabled={plan.ctaDisabled}
              onClick={() => plan.url && handleBuy(plan.url)}
            >
              {currentPlan === plan.id ? '✓ Current Plan' : plan.cta}
            </button>

            {plan.url && (
              <div className={styles.poweredBy}>🔒 Secured by Paystack</div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.afterPayment}>
        <div className={styles.afterPaymentTitle}>After Payment</div>
        <div className={styles.afterPaymentText}>
          After completing payment on Paystack, send your payment confirmation
          to activate your plan. Your scans will be credited within minutes.
        </div>
        
        <a href="https://wa.me/27813884972?text=Hi,%20I%20just%20paid%20for%20Navigator%20AI%20subscription"
          target="_blank"
          rel="noreferrer"
          className={styles.whatsappBtn}
        >
          📲 Send Confirmation via WhatsApp
        </a>
      </div>

      <div className={styles.faq}>
        {[
          { q: 'What counts as a scan?', a: 'Each time you tap Scan and get a result counts as one scan. Multi-TF uses 4 scans.' },
          { q: 'Do Standard scans expire?', a: 'No — Standard plan scans never expire. Use them at your own pace.' },
          { q: 'When does Premium reset?', a: 'Premium unlimited scans reset 30 days from your payment date.' },
          { q: 'Which payment methods are accepted?', a: 'Card, bank transfer, USSD, and mobile money via Paystack.' },
        ].map(({ q, a }) => (
          <div key={q} className={styles.faqItem}>
            <div className={styles.faqQ}>{q}</div>
            <div className={styles.faqA}>{a}</div>
          </div>
        ))}
      </div>

    </div> 
  )
}