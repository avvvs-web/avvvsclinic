// The speciality clinics. Copy is the clinic's own (supplied 2026-11-08), set for the page; nothing
// here promises an outcome. "short" answers are written to be quoted on their own (AEO/GEO).

export interface QA { q: string; a: string }

export interface Clinic {
  slug: string;
  no: string;
  name: string;
  /** a two or three word label for menus and the booking form */
  label: string;
  kicker: string;
  title: string;
  /** one sentence, quotable on its own: what this clinic is */
  short: string;
  lede: string;
  body: string[];
  focus: { h: string; p: string }[];
  therapies: string[];
  image: { src: string; alt: string; position?: string };
  faq: QA[];
  lead?: string;
}

const consult: QA = {
  q: 'Should I stop my current medicines before an Ayurveda consultation?',
  a: 'No. Bring a list of the medicines and supplements you take, and any recent reports, to your consultation. Do not stop or change a prescribed treatment without the advice of the doctor who prescribed it.',
};

const book: QA = {
  q: 'How do I book an appointment?',
  a: 'Book a consultation on clinic.avvvs.com/book, or call +91 99469 29448 or +91 80892 02092. The clinic is on the 3rd floor of Kaloor Central, Annie Hall Road, opposite Kozhikode Railway Station.',
};

export const CLINICS: Clinic[] = [
  {
    slug: 'headache-clinic',
    no: '01',
    name: 'Headache Clinic',
    label: 'Headache',
    kicker: 'Speciality clinic',
    title: 'When headaches keep coming back',
    short: 'The AVVVS Headache Clinic in Kozhikode offers Ayurvedic care for persistent headaches, including migraines, tension-type headaches, cluster headaches, sinus headaches and daily headaches, including status migrainosus.',
    lede: 'Persistent headaches can significantly affect daily life and well-being.',
    body: [
            'Ayurveda focuses on identifying underlying imbalances and managing symptoms through personalised treatments, therapies and lifestyle modifications.',
    ],
    focus: [
      { h: 'Migraine', p: 'Recurring headaches, often on one side and pulsating, which may or may not be accompanied by nausea, vomiting or sensitivity to light or sound.' },
      { h: 'Tension headache', p: 'A dull, aching pain or band-like pressure around the head, often described as a tight band, and commonly associated with stress, poor posture and long hours spent at a screen.' },
      { h: 'Cluster headache', p: 'Short, severe episodes of pain, usually around or behind one eye, occurring in clusters over days or weeks.' },
      { h: 'Sinus headache', p: 'Pain and pressure around the forehead, eyes and cheeks, often associated with nasal congestion and sinus inflammation.' },
    ],
    therapies: ['shirodhara', 'nasya'],
    image: { src: '/photos/headache.jpg', alt: 'A woman pressing her fingertips to her temple', position: '45% 40%' },
    faq: [
      { q: 'Which headaches does the Headache Clinic see?', a: 'The clinic sees persistent headaches, including migraine, tension, cluster and sinus headaches. Treatment is decided after a consultation, based on individual needs.' },
      { q: 'When should you seek emergency care?', a: 'Seek immediate medical attention for a sudden, severe headache unlike any before, or a headache accompanied by fever, stiff neck, confusion, weakness, numbness, repeated vomiting, vision loss, or following a head injury.' },
      consult, book,
    ],
  },
  {
    slug: 'pain-management-clinic',
    no: '02',
    name: 'Pain Management Clinic',
    label: 'Pain management',
    kicker: 'Speciality clinic',
    title: 'Get back to living more comfortably',
    short: 'The AVVVS Pain Management Clinic in Kozhikode combines Ayurvedic therapies with modern medical care under Dr. Ranjith Kumar (BAMS, MBBS, DA, MD), offering treatment tailored to individual needs for chronic pain and improved mobility.',
    lede: 'Living with pain can make even the simplest everyday activities difficult, keeping you from doing the things you love.',
    body: [
      'Through personalised treatment plans, we help you manage pain, improve mobility and get back to living life more comfortably.',
    ],
    focus: [
      { h: 'Integrated care', p: 'Ayurvedic therapies and modern medicine, considered together by one doctor.' },
      { h: 'Personalised plans', p: 'A plan written for your pain, your history and your daily life.' },
      { h: 'Mobility', p: 'Care aimed at moving more freely and getting back to everyday activities.' },
    ],
    therapies: ['kati-vasti', 'pizhichil', 'abhyanga', 'elakizhi', 'njavarakizhi', 'dhanyamla-dhara', 'lepana'],
    image: { src: '/photos/pain.jpg', alt: 'A doctor’s hands examining a patient’s lower back', position: '45% 45%' },
    lead: 'Under the guidance of Dr. Ranjith Kumar, BAMS, MBBS, DA, MD',
    faq: [
      { q: 'Who leads the Pain Management Clinic?', a: 'The Pain Management Clinic is guided by Dr. Ranjith Kumar (BAMS, MBBS, DA, MD), who is qualified in both Ayurveda and modern medicine.' },
      { q: 'What does an integrated approach to pain mean here?', a: 'Ayurvedic therapies are combined with modern medical care to provide a treatment plan suited to each patient’s needs, helping manage pain and improve mobility.' },
      consult, book,
    ],
  },
  {
    slug: 'obesity-lifestyle-clinic',
    no: '03',
    name: 'Obesity and Lifestyle Management Clinic',
    label: 'Obesity and lifestyle',
    kicker: 'Speciality clinic',
    title: 'Your journey to a healthier you',
    short: 'The AVVVS Obesity and Lifestyle Management Clinic in Kozhikode focuses on healthy weight management and lifestyle-related disorders, combining Ayurvedic therapies such as Udwarthana with modern body-contouring treatments like cryolipolysis, along with dietary guidance, exercise and lifestyle changes.',
    lede: 'Changing lifestyles, work patterns and dietary habits can contribute to weight gain and metabolic disorders, affecting your overall health, mobility and quality of life.',
    body: [
      'Obesity is more than a change in body weight; it can affect your overall health and well-being.',
      'For lifestyle and metabolic disorders, personalised Ayurvedic treatments, dietary guidance and lifestyle modifications help you manage these conditions, promoting better health and overall well-being.',
    ],
    focus: [
      { h: 'Udwarthana and body contouring', p: 'The traditional dry herbal-powder massage, alongside modern body-contouring technologies such as cryolipolysis.' },
      { h: 'Diet and exercise', p: 'Guidance on healthy eating and regular exercise to support weight management.' },
      { h: 'Lifestyle modification', p: 'Sleep, movement and routine, changed a step at a time.' },
    ],
    therapies: ['udwarthana', 'utsadana', 'dhanyamla-dhara', 'dhanyamla-kizhi'],
    image: { src: '/photos/lifestyle.jpg', alt: 'A person working at a desk at home', position: '40% 50%' },
    faq: [
      { q: 'What does the Obesity and Lifestyle Management Clinic offer?', a: 'Ayurvedic therapies such as Udwarthana, modern body-contouring technologies like cryolipolysis, dietary guidance, exercise and lifestyle modification, combined to support healthy weight management and to help manage metabolic and lifestyle disorders.' },
      { q: 'What is Udwarthana?', a: 'Udwarthana is a traditional Ayurvedic massage with dry herbal powders, given with firm upward strokes. The herbal powder used for Udwarthana is selected based on your condition and individual needs.' },
      consult, book,
    ],
  },
  {
    slug: 'infertility-clinic',
    no: '04',
    name: 'Male and Female Infertility Clinic',
    label: 'Infertility',
    kicker: 'Speciality clinic',
    title: 'Beside you on the way to parenthood',
    short: 'The AVVVS Male and Female Infertility Clinic in Kozhikode offers specialised Ayurvedic care for male and female reproductive health, taking a holistic approach to support couples on their journey towards parenthood.',
    lede: 'Fertility challenges can be an emotional and difficult journey for couples.',
    body: [],
    focus: [
      { h: 'Care for both partners', p: 'Treatments for male and female reproductive health, chosen to suit each person’s individual needs.' },
    ],
    therapies: ['abhyanga', 'udwarthana', 'snehapanam', 'kashaya-vasti', 'sneha-vasti', 'uttara-vasti'],
    image: { src: '/photos/infertility.jpg', alt: 'A doctor’s hands cradling a pair of knitted baby shoes held by a woman', position: '55% 50%' },
    faq: [
      { q: 'Does the clinic see both partners?', a: 'Yes. The clinic offers personalised Ayurvedic care for both male and female reproductive health.' },
      { q: 'Can I continue fertility treatment elsewhere while I consult here?', a: 'Tell the clinic about any fertility treatment and medicines you are on. Do not stop or change prescribed treatment without the advice of the doctor managing it.' },
      book,
    ],
  },
  {
    slug: 'pregnancy-postnatal-care-clinic',
    no: '05',
    name: 'Pregnancy and Postnatal Care Clinic',
    label: 'Pregnancy and postnatal',
    kicker: 'Speciality clinic',
    title: 'Nurturing the mother who nurtures new life',
    short: 'The AVVVS Pregnancy and Postnatal Care Clinic in Kozhikode provides Ayurvedic care during pregnancy and after childbirth, with dietary guidance and supportive therapies suited to mothers’ needs at every stage, alongside regular antenatal care.',
    lede: 'Pregnancy and motherhood bring changing care needs at every stage.',
    body: [
      'Ayurveda emphasises nurturing the mother who nurtures new life, recognising the importance of her health and well-being.',
    ],
    focus: [
      { h: 'During pregnancy', p: 'Personalised care and dietary guidance tailored to your needs, month by month, alongside regular antenatal care.' },
      // the lines after the first are shown as a list (the clinic's own points, supplied 2026-11-17)
      { h: 'After birth', p: 'Supportive postnatal therapies rooted in Kerala’s Ayurvedic tradition, which:\nRestore strength and vitality.\nSupport abdominal and pelvic muscle recovery.\nRelieve back pain and body aches.\nSupport healthy breast milk production.\nHelp reduce pigmentation and improve skin tone.' },
    ],
    therapies: ['abhyanga', 'varnya-lepana', 'vethu-kuli', 'dhoomapana', 'keshadhupana', 'anjana', 'veshtanam'],
    image: { src: '/photos/mother.jpg', alt: 'An expectant mother resting her hands on her belly', position: '50% 40%' },
    faq: [
      { q: 'Does Ayurvedic pregnancy care replace my obstetrician?', a: 'No. Ayurvedic pregnancy care at the clinic is given alongside your regular antenatal care. Keep up with all your obstetric appointments and tell both the doctors about every medicine you take.' },
      { q: 'What does postnatal care at the clinic include?', a: 'Personalised Ayurvedic care with therapies such as Abhyanga and Vethu Kuli, chosen after a consultation to suit each mother’s needs, along with dietary guidance and supportive care.' },
      book,
    ],
  },
];

export const LIFESTYLE_NOTE = 'Speciality care for headaches, chronic pain, obesity and lifestyle disorders, reproductive health, skin and hair, and pregnancy and postnatal care.';

export const clinicBySlug = (slug: string) => CLINICS.find((c) => c.slug === slug);

/** Gloveda Revive: the clinic's Ayur-Medi Cosmetic Clinic for skin and hair. */
export const REVIVE = {
  slug: 'gloveda-revive',
  name: 'Gloveda Revive',
  kicker: 'Ayur-Medi Cosmetic Clinic',
  short: 'Gloveda Revive is an Ayur-Medi Cosmetic Clinic franchise, first established at AVVVS Ayur Speciality Clinic, Kozhikode. It combines traditional Ayurvedic formulations with modern skin and hair care technologies.',
  lede: 'Rooted in over 105 years of authentic Ayurvedic heritage, trust and expertise.',
  body: [
    'It offers specialised solutions for a wide range of skin and hair concerns.',
  ],
  pillars: ['Healthy skin', 'Beautiful hair'],
  /** the clinic's own treatments, named by the clinic; not among the Ayurvedic therapies */
  treatments: ['Ayur-Medi facials', 'hair fall and dandruff treatment'],
  /** the treatment menu, from the clinic's Gloveda Revive brochure (supplied 2026-11-16) */
  menu: [
    {
      title: 'Signature Ayur-Medi facials',
      items: [
        { name: 'Gloveda Saffron Glow Facial with Needle-Free Mesotherapy', p: 'A luxurious saffron-infused glow ritual, paired with meso-electroporation technology.' },
        { name: 'Gloveda Radiance Clean-Up Facial', p: 'A refreshing deep-clean facial, designed to refine the skin’s appearance.' },
        { name: 'Gloveda Acne Clear Facial with Ayur-Medi Infusion', p: 'A clarifying facial for acne-prone skin that combines Ayurvedic care with gentle medi-suction, for deeply cleansed, clear skin.' },
        { name: 'Gloveda Glowlift Contour Facial', p: 'A sculpting and revitalising facial for the face and neck, with Marma point massage for relaxation and a refreshed, contoured look.' },
        { name: 'Gloveda Kamsya Wand Detox & Glow Facial', p: 'A purifying facial, complemented by a traditional Kamsya wand massage, that leaves the skin refreshed, relaxed and rejuvenated.' },
        { name: 'Gloveda Advanced De-tan Resurfacing Facial', p: 'A revitalising treatment that combines de-tan care with microdermabrasion.' },
        { name: 'Gloveda Ayurhydra Infusion Facial', p: 'An intensive hydration ritual that deeply cleanses, replenishes and revives the skin, for a soft, fresh, healthy-looking glow.' },
        { name: 'Gloveda Collagen Restore Facial with Microneedling', p: 'An advanced skin-rejuvenation ritual with microneedling, for smoother, firmer, more youthful-looking skin.' },
      ],
    },
    {
      title: 'Hair care therapies',
      items: [
        { name: 'Gloveda Hairfall Treatment', p: 'A purifying scalp ritual, designed to cleanse away build-up and refresh the scalp.' },
        { name: 'Gloveda Anti-Dandruff Scalp Revival', p: 'An advanced Ayurvedic scalp treatment that combines exfoliation, meso-jet and meso combing.' },
        { name: 'Gloveda KeshaVive Hair Root Revival Treatment', p: 'A specialised scalp treatment for concerns such as hair thinning and early-stage baldness.' },
      ],
    },
    {
      title: 'Eye and foot care',
      items: [
        { name: 'Gloveda Eye Revive', p: 'Refreshes and revitalises the delicate eye area, for a more rested look.' },
        { name: 'Gloveda Foot Revive', p: 'Relaxing foot care that soothes the feet and leaves them rejuvenated.' },
      ],
    },
  ],
  therapies: [] as string[],
  /** the clinic's own wording (supplied 2026-11-16), shown on the Gloveda Revive page */
  facials: {
    title: 'Why Ayur-Medi facials?',
    points: [
      'Customised Ayurvedic skincare formulations.',
      'Modern skincare technologies to enhance skin resurfacing and product absorption.',
      'Specialised face contouring and lymphatic drainage techniques.',
      'Therapeutic facial massage to relax deeper facial muscles and release tension.',
      'Marma point stimulation for rejuvenation.',
      'Intense hydration, nourishment and anti-ageing care.',
      'Doctor-led procedures tailored to individual skin concerns.',
    ],
    close: 'Doctor-led. Technology-enhanced. Rooted in Ayurveda.',
  },
};
