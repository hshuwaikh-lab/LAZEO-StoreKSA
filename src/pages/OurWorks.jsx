import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Boxes, Sparkles, Truck } from 'lucide-react';
import {
  ourWorksDeliveredWorks,
  ourWorksEditableNote,
  ourWorksHero,
  ourWorksHighlights,
  ourWorksPortfolio,
  ourWorksReviews,
  ourWorksServices,
} from '../data/ourWorksContent';
import './OurWorks.css';

const metrics = [
  { value: '5+', label: 'أعمال منجزة', icon: Boxes },
  { value: '100%', label: 'محتوى قابل للتعديل', icon: Sparkles },
  { value: '1', label: 'ملف بيانات مركزي', icon: BadgeCheck },
  { value: '24/7', label: 'جاهزية للعرض والتحديث', icon: Truck },
];

const OurWorks = () => {
  const buildContactLink = (projectTitle = 'الأعمال المنفذة') => `/custom-order?project=${encodeURIComponent(projectTitle)}`;

  return (
    <div className="our-works-page">
      <section className="our-works-hero">
        <div className="our-works-hero__content">
          <span className="our-works-kicker">{ourWorksHero.kicker}</span>
          <h1>{ourWorksHero.title}</h1>
          <p>{ourWorksHero.description}</p>
          <div className="our-works-actions">
            <Link to="/shop" className="btn-primary">تصفح المنتجات</Link>
            <Link to={buildContactLink()} className="btn-primary our-works-contact-primary">
              تواصل معنا
            </Link>
            <Link to="/custom-order" className="btn-outline our-works-outline">
              طلب مخصص
              <ArrowLeft size={18} />
            </Link>
          </div>
          <div className="our-works-editable-note">{ourWorksEditableNote}</div>
        </div>

        <div className="our-works-hero__panel glass">
          <div className="our-works-panel__title">أهم ما تم تنفيذه</div>
          <div className="our-works-visual-strip">
            {ourWorksHighlights.map((item) => (
              <div key={item.title} className="our-works-visual-card" style={{ background: item.tone }}>
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>
            ))}
          </div>
          <div className="our-works-pill-list">
            <span>أعمال منجزة</span>
            <span>وصف واضح</span>
            <span>تعديل سريع</span>
            <span>محتوى مركزي</span>
            <span>عرض مرن</span>
            <span>جاهزية للتحديث</span>
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
          <span>الأعمال المنفذة</span>
          <h2>ماذا قمنا به بالفعل</h2>
        </div>

        <div className="our-works-grid">
          {ourWorksDeliveredWorks.map((work, index) => (
            <article key={work.title} className="our-works-card glass">
              <div className="our-works-card__media" style={{ background: 'linear-gradient(135deg, #0f172a, #334155)' }}>
                <span>0{index + 1}</span>
              </div>
              <div className="our-works-card__body">
                <span className="our-works-card__category">{work.category}</span>
                <h3>{work.title}</h3>
                <p>{work.description}</p>
                <Link to={buildContactLink(work.title)} className="our-works-contact-btn">
                  تواصل بخصوص هذا العمل
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="our-works-section">
        <div className="our-works-section__heading">
          <span>معرض الأعمال</span>
          <h2>نماذج تنفيذ قابلة للتعديل</h2>
        </div>

        <div className="our-works-portfolio-grid">
          {ourWorksPortfolio.map((item, index) => (
            <article key={item.title} className="our-works-portfolio-card glass">
              <div className="our-works-portfolio-media" style={{ background: item.gradient }}>
                <span>0{index + 1}</span>
                <strong>{item.category}</strong>
              </div>
              <div className="our-works-card__body">
                <span className="our-works-card__category">{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <ul className="our-works-mini-list">
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <Link to={buildContactLink(item.title)} className="our-works-contact-btn">
                  تواصل بخصوص هذا العمل
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="our-works-section">
        <div className="our-works-section__heading">
          <span>آراء العملاء</span>
          <h2>تقييمات بعد تنفيذ كل عمل</h2>
        </div>

        <div className="our-works-review-actions">
          <Link to={buildContactLink()} className="our-works-contact-btn our-works-contact-btn--inline">
            تواصل بخصوص الأعمال المنفذة
          </Link>
        </div>

        <div className="our-works-reviews-grid">
          {ourWorksReviews.map((review) => (
            <article key={`${review.name}-${review.project}`} className="our-works-review-card glass">
              <div className="our-works-review-stars">
                {Array.from({ length: review.rating }).map((_, index) => (
                  <span key={`${review.name}-${index}`}>★</span>
                ))}
              </div>
              <p className="our-works-review-comment">{review.comment}</p>
              <div className="our-works-review-meta">
                <strong>{review.name}</strong>
                <span>{review.project}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="our-works-section our-works-split">
        <div className="our-works-callout glass">
          <span className="our-works-callout__label">ما الذي نقدمه أيضًا</span>
          <h2>الصفحة لا تعرض النص فقط، بل تشرح نطاق العمل الذي أنجزناه</h2>
          <p>
            نركز على عرض الأعمال المكتملة بشكل واضح: المتجر، إدارة المنتجات، تعدد الصور، الرفع المباشر، ونسخة التثبيت.
          </p>
          <div className="our-works-actions">
            <Link to="/custom-order" className="btn-primary">ابدأ طلبك</Link>
            <Link to="/" className="btn-outline our-works-outline">العودة للرئيسية</Link>
          </div>
        </div>

        <div className="our-works-list glass">
          <h3>الخدمات المغطاة</h3>
          <ul>
            {ourWorksServices.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default OurWorks;
