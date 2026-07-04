import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Boxes, Sparkles, Truck } from 'lucide-react';
import './OurWorks.css';

const featuredWorks = [
  {
    title: 'هوية متجر متكاملة',
    description: 'تصميم تجربة متجر واضحة ومتماسكة من الصفحة الرئيسية إلى صفحة المنتج والطلب.',
    accent: 'linear-gradient(135deg, #0f172a, #334155)',
  },
  {
    title: 'تغليف بصري للمنتجات',
    description: 'معاينات صور، عروض، ومعرض صور يساعد العميل على فهم المنتج بسرعة.',
    accent: 'linear-gradient(135deg, #0f766e, #14b8a6)',
  },
  {
    title: 'طلبات خاصة حسب الطلب',
    description: 'نماذج مرنة للطلبات المخصصة مع متابعة الدفع والحالة خطوة بخطوة.',
    accent: 'linear-gradient(135deg, #b45309, #f59e0b)',
  },
  {
    title: 'تجربة شحن ودفع',
    description: 'ربط خيارات الشحن، البنوك، ورفع الإيصالات داخل مسار واحد بسيط.',
    accent: 'linear-gradient(135deg, #4f46e5, #2563eb)',
  },
];

const metrics = [
  { value: '4+', label: 'مجالات عرض رئيسية', icon: Boxes },
  { value: '100%', label: 'تركيز على تجربة الشراء', icon: Sparkles },
  { value: '1', label: 'واجهة موحدة للبيع والإدارة', icon: BadgeCheck },
  { value: '24/7', label: 'جاهزية للطلب والمتابعة', icon: Truck },
];

const visualHighlights = [
  { title: 'واجهة البيع', subtitle: 'Hero + عروض + منتجات', tone: 'linear-gradient(135deg, #0f172a, #1e293b)' },
  { title: 'صفحة منتج', subtitle: 'معرض صور وتفاصيل', tone: 'linear-gradient(135deg, #0f766e, #14b8a6)' },
  { title: 'تجربة الطلب', subtitle: 'دفع + شحن + إيصال', tone: 'linear-gradient(135deg, #4f46e5, #2563eb)' },
  { title: 'لوحة الإدارة', subtitle: 'منتجات + طلبات + إدارة', tone: 'linear-gradient(135deg, #b45309, #f59e0b)' },
];

const OurWorks = () => {
  return (
    <div className="our-works-page">
      <section className="our-works-hero">
        <div className="our-works-hero__content">
          <span className="our-works-kicker">أعمالنا</span>
          <h1>نماذج من التجارب التي نبنيها للمتاجر والعلامات التجارية</h1>
          <p>
            هذه الصفحة تعرض أسلوب العمل، شكل العرض، وطريقة تنظيم المنتج والطلب والدفع ضمن تجربة واحدة واضحة وسريعة.
          </p>
          <div className="our-works-actions">
            <Link to="/shop" className="btn-primary">تصفح المنتجات</Link>
            <Link to="/custom-order" className="btn-outline our-works-outline">
              طلب مخصص
              <ArrowLeft size={18} />
            </Link>
          </div>
        </div>

        <div className="our-works-hero__panel glass">
          <div className="our-works-panel__title">ماذا نقدّم</div>
          <div className="our-works-visual-strip">
            {visualHighlights.map((item) => (
              <div key={item.title} className="our-works-visual-card" style={{ background: item.tone }}>
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>
            ))}
          </div>
          <div className="our-works-pill-list">
            <span>متاجر إلكترونية</span>
            <span>معارض منتجات</span>
            <span>طلبات مخصصة</span>
            <span>لوحات إدارة</span>
            <span>تجارب دفع</span>
            <span>شحن وتتبع</span>
          </div>
        </div>
      </section>

      <section className="our-works-stats">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article key={metric.label} className="our-works-stat-card glass">
              <div className="our-works-stat-icon"><Icon size={20} /></div>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </article>
          );
        })}
      </section>

      <section className="our-works-section">
        <div className="our-works-section__heading">
          <span>مختارات العمل</span>
          <h2>ماذا يشمل التنفيذ عادةً</h2>
        </div>

        <div className="our-works-grid">
          {featuredWorks.map((work, index) => (
            <article key={work.title} className="our-works-card glass">
              <div className="our-works-card__media" style={{ background: work.accent }}>
                <span>0{index + 1}</span>
              </div>
              <div className="our-works-card__body">
                <h3>{work.title}</h3>
                <p>{work.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="our-works-section our-works-split">
        <div className="our-works-callout glass">
          <span className="our-works-callout__label">خطوة تالية</span>
          <h2>إذا كان لديك مشروع جديد، يمكن تحويله إلى تجربة شراء كاملة</h2>
          <p>
            نبدأ من العرض البصري، ثم بناء صفحات المنتج والطلب، وبعدها نضبط تفاصيل الإدارة والتشغيل حسب الحاجة.
          </p>
          <div className="our-works-actions">
            <Link to="/custom-order" className="btn-primary">ابدأ طلبك</Link>
            <Link to="/" className="btn-outline our-works-outline">العودة للرئيسية</Link>
          </div>
        </div>

        <div className="our-works-list glass">
          <h3>المسارات التي نغطيها</h3>
          <ul>
            <li>تصميم تجربة المتجر والصفحات الأساسية</li>
            <li>رفع المنتجات وتعدد الصور والعروض</li>
            <li>إدارة الطلبات والدفع والشحن</li>
            <li>مسارات الإدارة للمكتب واللوحة</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default OurWorks;
