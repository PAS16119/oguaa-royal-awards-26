// Seed definition for the FREE (committee/merit) award track.
// Taken from "35th Anniversary Celebrations — Awards Criteria".
//
// nominable: true  -> students & staff nominate on the free portal
// nominable: false -> decided from official records / committee list only
//                     (shown on the site as "awarded on record", no form)
//
// This file is only used ONCE, to seed the database. After that the
// live list lives in Postgres and is edited from Admin -> Awards.

export const FREE_SECTIONS = [
  {
    key: 'merit-academic',
    label: 'Academic Awards (from records)',
    emoji: '📕',
    color: '#1F4E78',
    awards: [
      ['Best Student in Each Department (All Subjects Combined)', false, 'One per department, 9 departments. Highest aggregate across all departmental subjects.'],
      ['Best Student in Each Subject — 1st Place', false, 'One per subject, 34 subjects. Highest subject score for the year.'],
      ['Best Student in Each Subject — 2nd Place (Core Subjects)', false, 'Second-highest subject score, core subjects only.'],
      ['Overall Best Student — Form 2', false, 'Highest overall aggregate in the form for the year.'],
      ['Overall Best Student — Form 3', false, 'Highest overall aggregate in the form for the year.'],
      ['Best Graduating Student (2026)', false, 'Best cumulative academic performance across the full duration of study.'],
    ],
  },
  {
    key: 'merit-student',
    label: 'Student Merit & Character',
    emoji: '🌱',
    color: '#0F5132',
    awards: [
      ['Most Improved Student — Form 2', true, 'Largest positive change in aggregate/class position against the reference term.'],
      ['Most Improved Student — Form 3', true, 'Largest positive change in aggregate/class position against the reference term.'],
      ['Sports Personality — Male (Form 2)', true, 'Performance, sportsmanship and consistency in inter-house, inter-school or regional competition.'],
      ['Sports Personality — Female (Form 2)', true, 'Performance, sportsmanship and consistency in inter-house, inter-school or regional competition.'],
      ['Sports Personality — Male (Form 3)', true, 'Performance, sportsmanship and consistency in inter-house, inter-school or regional competition.'],
      ['Sports Personality — Female (Form 3)', true, 'Performance, sportsmanship and consistency in inter-house, inter-school or regional competition.'],
      ['Most Disciplined (Best Behaved) — Form 2', true, 'No recorded sanction; consistent conduct reports from teachers, prefects and house heads.'],
      ['Most Disciplined (Best Behaved) — Form 3', true, 'No recorded sanction; consistent conduct reports from teachers, prefects and house heads.'],
      ['Most Hardworking — Form 2', true, 'Diligence in class work, assignments and independent study across multiple subjects.'],
      ['Most Hardworking — Form 3', true, 'Diligence in class work, assignments and independent study across multiple subjects.'],
      ['Most Outstanding Student (2026)', true, 'Exceptional achievement beyond academics: leadership, sports, arts, community service, competitions.'],
    ],
  },
  {
    key: 'merit-staff',
    label: 'Staff Awards & Recognition',
    emoji: '🎖️',
    color: '#7A1F3D',
    awards: [
      ['Best Teaching Staff', true, 'Teaching effectiveness, professionalism, punctuality and contribution to school life. Top 3 become the shortlist; 2 runners-up.'],
      ['Best Non-Teaching Staff', true, 'Diligence, reliability, professionalism and contribution to smooth school operations. Top 3 become the shortlist; 2 runners-up.'],
      ['Long Service Award — Teaching Staff', true, '20+ years continuous service, good standing, not previously awarded.'],
      ['Long Service Award — Non-Teaching Staff', true, '20+ years continuous service, good standing, not previously awarded.'],
      ['Recognition of Retired Past Staff', false, 'List finalised by the Awards Committee from service records.'],
      ['Special Honours', false, 'Dignitaries, PTA, traditional authority, benefactors and partners — list finalised by the Committee.'],
    ],
  },
];
