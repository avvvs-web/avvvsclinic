# Compliance check: clinic.avvvs.com, including payment processing

Reviewed 15 November 2026 against the code at `a97e6b8` plus the changes in this commit.
This is a working checklist for the clinic and its lawyer. It is not legal advice. Rules change, so confirm each point with an Indian lawyer before relying on it.

## Summary

**Proceed, with conditions.** The site already has a solid base: consent-gated analytics, a privacy notice written for the DPDP Act, an explicit consent checkbox for video consultations, and payments switched off. Before **online payment** goes live, three things are needed:

1. The clinic confirms the refund rules on `/refunds`.
2. A grievance officer is named on the site.
3. Each doctor's registration number is published, as the telemedicine guidelines require.

## What the site does

| Flow | Personal data | Where it goes |
|---|---|---|
| Visit request (`/book`) | name, phone, optional email, age, visit history, free-text note (may include health information) | SMTP email to the clinic inbox; not stored in the database |
| Online consultation (`/consult`) | name, phone, email, optional age and note, doctor, time, consent time | Neon Postgres (`clinic_appointments`), Google Calendar and Meet, emails to the patient, the doctor and the clinic |
| Reminders | name, email, time, Meet link | email, 7 am IST |
| Admin | all of the above; CSV export | password-protected admin |
| Analytics | usage, cookies | GA4 and Meta Pixel, only after opt-in |
| Payments | none yet (`lib/payments.ts` returns the `none` provider) | a future gateway, e.g. Razorpay |

## Applicable law

| Law | Why it applies | Key requirements |
|---|---|---|
| **Digital Personal Data Protection Act 2023 + DPDP Rules 2025** (notified Nov 2025) | The site collects personal data of people in India, including health notes | Notice and consent: itemised, plain language, withdrawable. Security safeguards. Breach notice to the Board and the people affected. Erasure once the purpose is served. Grievance redress. **Most of the Rules apply from about 13–14 May 2027**; the Board and the Act's definitions already apply. |
| **IT Act 2000 s.43A + SPDI Rules 2011** | In force until the DPDP Rules take over. Health and medical records and financial information are "sensitive personal data" | Privacy policy; written consent for sensitive data; a named grievance officer; reasonable security practices (ISO 27001 or equivalent) |
| **Telemedicine Practice Guidelines for AYUSH (2020)** and the **NMC Telemedicine Practice Guidelines (2020)** for the MBBS doctors | Video consultations with BAMS and MBBS doctors | The patient's consent to teleconsultation; the doctor identifies themselves with their **registration number**; prescribing limits by drug category; records of the teleconsultation kept for 3 years; the doctor uses judgement about whether teleconsultation is suitable |
| **NCISM (Indian Medicine) ethics regulations** and the **NMC professional conduct rules** | Doctors' profiles and clinic promotion | Limits on self-advertising and claims; qualifications stated accurately |
| **Drugs and Magic Remedies (Objectionable Advertisements) Act 1954** | The pages promote care for infertility, obesity and similar conditions | No advertisement of a *drug or remedy* for the listed conditions (the Schedule includes sterility, impotence and obesity). Clinic-service pages must not promise cures or name remedies for these conditions. |
| **Consumer Protection Act 2019 + E-Commerce Rules 2020** | Paid consultations sold online | Total price shown before payment; refund and cancellation terms; a grievance officer; complaints acknowledged within 48 hours and resolved within one month |
| **RBI payment aggregator directions + card tokenisation rules** | Once a gateway is used | Use an RBI-authorised aggregator; the clinic never stores card data (the gateway's hosted checkout does this); refunds go to the original payment method |
| **GST / Income Tax** | Fees | Healthcare by clinical establishments is GST-exempt (SAC 9993); confirm with the clinic's accountant. Accounts kept about 8 years. |
| **Kerala Clinical Establishments (Registration and Regulation) Act 2018** | The physical clinic | Registration; fees displayed at the clinic. This is offline, so it is outside the website. |

## Requirements

| # | Requirement | Status | Action |
|---|---|---|---|
| 1 | Privacy notice at the point of collection | **Met** | Both forms now link to `/privacy` |
| 2 | Consent to teleconsultation | **Met** | Checkbox in `ConsultForm`; `consent_at` stored |
| 3 | Itemised consent for health data (DPDP Rule 3, from May 2027) | Partly met | Consent to teleconsultation and to data use are one checkbox. Before May 2027, split them, or add a line naming the data and its purposes next to the box. |
| 4 | Analytics only with consent | **Met** | `CookieConsent` / `Analytics` |
| 5 | Grievance officer named (SPDI Rule 5(9); E-Commerce Rules) | **Not met** | The clinic names a person; add their name and designation to `/privacy`, `/refunds` and the footer |
| 6 | Doctors' registration numbers shown (telemedicine guidelines) | **Not met** | Add a registration field to doctors in the admin and show it on the doctor page and in the booking confirmation |
| 7 | Teleconsultation records kept for 3 years | **Unknown** | The site stores the appointment; the doctor's notes and prescriptions are kept outside it. Confirm where. Do not delete `clinic_appointments` rows sooner. |
| 8 | Retention and erasure | Partly met | No automatic deletion yet. Set a rule: for example, erase notes 3 years after the appointment and keep payment rows 8 years. Erasure requests are handled by hand for now. |
| 9 | Breach response | **Met** (wording) | Commitment in `/privacy#security`. Write a one-page internal runbook: who decides, 72-hour report to the Board. |
| 10 | Cross-border processing disclosed | **Met** | Vercel, Neon, Google, Meta disclosed. Data Processing Agreements with each: accept their standard DPAs. |
| 11 | Refund and cancellation policy | **Met (draft)** | New `/refunds`; **the clinic must confirm the rules** |
| 12 | Price including tax before booking | **Met** | Fee shown on the doctor card |
| 13 | Gateway-required pages (Razorpay: About, Contact, Pricing, Terms, Privacy, Refunds) | Mostly met | All exist except a page that lists fees; per-doctor fees are shown in booking. If the gateway asks, add a short fees table to `/refunds#fees`. |
| 14 | No card data on our servers | **Met by design** | `PaymentProvider` uses the gateway checkout; only status, reference and amount are stored |
| 15 | Payment webhook verified | To build | The adapter's `verify()` must check the gateway signature and the amount, and be idempotent |
| 16 | Health claims in clinic pages | **Review** | A lawyer or the doctors should read the infertility, obesity and pregnancy pages for cure claims |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Free-text health notes emailed to a Gmail inbox | Medium | Already advised against sharing reports. Move the clinic inbox to a business account with 2-step verification, and limit who reads it. |
| No grievance officer named | Medium | Name one (item 5) |
| Doctors' registration not shown on video consults | Medium | Item 6 |
| MBBS and BAMS doctors in one Ayurveda clinic | Medium | Each prescribes only within their own system; the terms now say this. Confirm with the doctors. |
| Refund rules invented by the developer | Medium | The clinic confirms `/refunds` before payment is switched on |
| Chargebacks for no-shows | Low | Clear 2-hour rule, shown and linked at booking; keep `consent_at` and the emails as evidence |
| Analytics on health pages (ads targeting on health conditions) | Low | Opt-in only; consider turning the Meta Pixel off on condition pages |

## Recommended actions, in order

1. **Clinic:** confirm the refund rules on `/refunds` and name a grievance officer.
2. **Dev:** add doctors' registration numbers (admin field, doctor page, confirmation email).
3. **Dev, before payment goes live:** write the Razorpay adapter (`lib/payments-razorpay.ts`): hosted checkout, webhook signature check, a `refund()` that is wired to clinic cancellation, receipts by email.
4. **Lawyer:** review `/privacy`, `/terms`, `/refunds`, and the condition pages for advertising claims.
5. **Before May 2027:** split the consent checkbox, set retention periods, write the breach runbook, sign the processors' DPAs.

## Approvals

| Who | Why | Status |
|---|---|---|
| Medical Director | Refund rules, teleconsultation scope, registration numbers | Pending |
| Lawyer (Indian health and data law) | Policy wording, advertising claims | Pending |
| Accountant | GST treatment of online fees, receipts | Pending |
| AVVVS management | Name the grievance officer; open the gateway account | Pending |
