/**
 * Seeded supplemental-essay prompt library — 20 core schools.
 *
 * HONESTY: these prompts were captured from the 2025-26 cycle as known to the
 * model and are NOT live-verified. Every entry ships as
 * `status: 'needs_verification'` so the UI forces "verify the current prompt
 * before drafting". The one exception: UC PIQs, which the UC system has kept
 * stable for many cycles, ship as `current`. Prompts for the 2026-27 cycle
 * typically release in August — update this file (or use a custom prompt)
 * when schools publish.
 */
import type { EssayPrompt, PromptType } from './types';

const CYCLE = '2025-26';

/** Compact builder: unverified library entry. */
function p(schoolId: string, n: number, promptType: PromptType, promptText: string, wordLimit?: number, extra?: Partial<EssayPrompt>): EssayPrompt {
  return {
    id: `${schoolId}-${CYCLE}-${n}`,
    schoolId,
    admissionCycle: CYCLE,
    applicationRound: 'ALL',
    promptText,
    wordLimit,
    promptType,
    sourceType: 'verified_secondary',
    status: 'needs_verification',
    ...extra,
  };
}

/* UC Personal Insight Questions — pick 4 of 8, 350 words each. Stable across cycles. */
const UC_PIQS: Array<[PromptType, string]> = [
  ['identity', 'Describe an example of your leadership experience in which you have positively influenced others, helped resolve disputes, or contributed to group efforts over time.'],
  ['identity', 'Every person has a creative side, and it can be expressed in many ways: problem solving, original and innovative thinking, and artistically, to name a few. Describe how you express your creative side.'],
  ['activity', 'What would you say is your greatest talent or skill? How have you developed and demonstrated that talent over time?'],
  ['challenge', 'Describe how you have taken advantage of a significant educational opportunity or worked to overcome an educational barrier you have faced.'],
  ['challenge', 'Describe the most significant challenge you have faced and the steps you have taken to overcome this challenge. How has this challenge affected your academic achievement?'],
  ['intellectual_vitality', 'Think about an academic subject that inspires you. Describe how you have furthered this interest inside and/or outside of the classroom.'],
  ['community', 'What have you done to make your school or your community a better place?'],
  ['identity', 'Beyond what has already been shared in your application, what do you believe makes you a strong candidate for admissions to the University of California?'],
];

function ucPiqs(schoolId: string): EssayPrompt[] {
  return UC_PIQS.map(([type, text], i) => ({
    id: `${schoolId}-piq-${i + 1}`,
    schoolId,
    admissionCycle: CYCLE,
    applicationRound: 'ALL' as const,
    promptText: `[UC PIQ ${i + 1} of 8 — answer any 4] ${text}`,
    wordLimit: 350,
    promptType: type,
    sourceType: 'official' as const,
    status: 'current' as const,
  }));
}

export const ESSAY_PROMPT_LIBRARY: EssayPrompt[] = [
  // MIT — short answers
  p('mit', 1, 'why_major', 'What field of study appeals to you the most right now? Tell us more about why this field of study at MIT appeals to you.', 100),
  p('mit', 2, 'activity', 'We know you lead a busy life, full of activities, many of which are required of you. Tell us about something you do simply for the pleasure of it.', 150),
  p('mit', 3, 'community', 'How has the world you come from — including your opportunities, experiences, and challenges — shaped your dreams and aspirations?', 225),
  p('mit', 4, 'community', 'MIT brings people with diverse backgrounds together to collaborate, from tackling the world’s biggest challenges to lending a helping hand. Describe one way you have collaborated with others to learn from them, with them, or contribute to your community together.', 225),
  p('mit', 5, 'challenge', 'How did you manage a situation or challenge that you didn’t expect? What did you learn from it?', 225),

  // Stanford
  p('stanford', 1, 'intellectual_vitality', 'The Stanford community is deeply curious and driven to learn in and out of the classroom. Reflect on an idea or experience that makes you genuinely excited about learning.', 250),
  p('stanford', 2, 'community', 'Virtually all of Stanford’s undergraduates live on campus. Write a note to your future roommate that reveals something about you or that will help your roommate — and us — get to know you better.', 250),
  p('stanford', 3, 'identity', 'Please describe what aspects of your life experiences, interests and character would help you make a distinctive contribution as an undergraduate to Stanford University.', 250),

  // Harvard
  p('harvard', 1, 'identity', 'Harvard has long recognized the importance of enrolling a diverse student body. How will the life experiences that shape who you are today enable you to contribute to Harvard?', 150),
  p('harvard', 2, 'intellectual_vitality', 'Briefly describe an intellectual experience that was important to you.', 150),
  p('harvard', 3, 'activity', 'Briefly describe any of your extracurricular activities, employment experience, travel, or family responsibilities that have shaped who you are.', 150),
  p('harvard', 4, 'why_school', 'How do you hope to use your Harvard education in the future?', 150),
  p('harvard', 5, 'community', 'Top 3 things your roommates might like to know about you.', 150),

  // Yale
  p('yale', 1, 'why_major', 'Students at Yale have time to explore their academic interests before committing to one or more major fields of study. Tell us about a topic or idea that excites you and is related to one or more academic areas you selected above.', 200),
  p('yale', 2, 'why_school', 'What is it about Yale that has led you to apply?', 125),
  p('yale', 3, 'community', 'Reflect on a time you discussed an issue important to you with someone holding an opposing view. Why did you find the experience meaningful?', 400),

  // Princeton
  p('princeton', 1, 'why_major', 'As a research institution that also prides itself on its liberal arts curriculum, Princeton allows students to explore areas across the humanities and the arts, the natural sciences, and the social sciences. What academic areas most pique your curiosity, and how do the programs offered at Princeton suit your particular interests?', 250),
  p('princeton', 2, 'community', 'At Princeton, we value diverse perspectives and the ability to have respectful dialogue about difficult issues. Share a time when you had a conversation with a person or a group of people about a difficult topic. What insight did you gain, and how would you incorporate that knowledge into your thinking in the future?', 250),
  p('princeton', 3, 'community', 'Princeton has a longstanding commitment to understanding our responsibility to society through service and civic engagement. How does your own story intersect with these ideals?', 250),

  // Columbia
  p('columbia', 1, 'community', 'A hallmark of the Columbia experience is being able to learn and thrive in an equitable and inclusive community with a wide range of perspectives. Tell us about an aspect of your own perspective, viewpoint or lived experience that is important to you, and describe how it has shaped the way you would learn from and contribute to Columbia’s diverse and collaborative community.', 150),
  p('columbia', 2, 'why_school', 'Why are you interested in attending Columbia University? We encourage you to consider the aspect(s) that you find unique and compelling about Columbia.', 150),
  p('columbia', 3, 'why_major', 'What attracts you to your preferred areas of study at Columbia College or Columbia Engineering?', 150, { programId: 'seas' }),

  // Cornell
  p('cornell', 1, 'community', 'We all contribute to, and are influenced by, the communities that are meaningful to us. Share how you’ve been shaped by one of the communities you belong to.', 350),
  p('cornell', 2, 'why_major', '[College of Engineering] How do your interests directly connect with Cornell Engineering? If you have an intended major, what draws you to that department at Cornell Engineering? If you are unsure what specific engineering field you would like to study, describe how your general interest in engineering most directly connects with Cornell Engineering.', 250, { programId: 'engineering' }),
  p('cornell', 3, 'why_major', '[College of Arts & Sciences] At the College of Arts and Sciences, curiosity will be your guide. Discuss how your passion for learning is shaping your academic journey, and what areas of study or majors excite you and why.', 650, { programId: 'cas' }),

  // Brown
  p('brown', 1, 'why_major', 'Brown’s Open Curriculum allows students to explore broadly while also diving deeply into their academic pursuits. Tell us about any academic interests that excite you, and how you might pursue them at Brown.', 250),
  p('brown', 2, 'community', 'Students entering Brown often find that making their home on College Hill naturally invites reflection on where they came from. Share how an aspect of your growing up has inspired or challenged you, and what unique contributions this might allow you to make to the Brown community.', 250),
  p('brown', 3, 'identity', 'Brown students care deeply about their work and the world around them. Students find contentment, satisfaction, and meaning in daily interactions and major discoveries. Whether big or small, mundane or spectacular, tell us about something that brings you joy.', 200),

  // Duke
  p('duke', 1, 'why_school', 'What is your sense of Duke as a university and a community, and why do you consider it a good match for you? If there’s something in particular about our offerings that attracts you, feel free to share that as well.', 250),
  p('duke', 2, 'identity', 'We believe a wide range of viewpoints, beliefs, and lived experiences are essential to maintaining Duke as a vibrant and meaningful living and learning community. Feel free to share with us anything in this context that might help us better understand you and what you might bring to our community.', 250),

  // Northwestern
  p('northwestern', 1, 'why_school', 'We want to be sure we’re considering your application in the context of your personal experiences: What aspects of your background, your identity, or your school, community, and/or household settings have most shaped how you see yourself engaging in Northwestern’s community, be it academically, extracurricularly, culturally, politically, socially, or otherwise?', 300),
  p('northwestern', 2, 'why_major', 'Painting “The Rock” is a tradition at Northwestern. Imagine you led a group of students to paint the Rock. What did you paint, and why? (Or: describe how a particular Northwestern program or offering connects to your interests.)', 300),

  // CMU
  p('cmu', 1, 'why_major', 'Most students choose their intended major or area of study based on a passion or inspiration that’s developed over time — what passion or inspiration led you to choose this area of study?', 300),
  p('cmu', 2, 'why_school', 'Why Carnegie Mellon? Please identify the reasons why CMU is a good fit for you — consider the unique aspects of our community and your intended program.', 300),
  p('cmu', 3, 'identity', 'Consider your application as a whole. What do you personally want to emphasize about your application for the admission committee’s consideration? Highlight something that’s important to you or something you haven’t had a chance to share.', 300),

  // NYU
  p('nyu', 1, 'community', 'In a world where disconnection seems to often prevail, we are looking for students who embody the qualities of bridge builders. Share a story about how you have helped bridge divides in your community or with people around you.', 250),

  // UPenn
  p('upenn', 1, 'community', 'Write a short thank-you note to someone you have not yet thanked and would like to acknowledge.', 200),
  p('upenn', 2, 'identity', 'How will you explore community at Penn? Consider how Penn will help shape your perspective, and how your experiences and perspective will help shape Penn.', 200),
  p('upenn', 3, 'why_major', 'Considering the specific undergraduate school you have selected, describe how you intend to explore your academic and intellectual interests at the University of Pennsylvania.', 200, { programId: 'per_school' }),

  // Rice
  p('rice', 1, 'why_major', 'Please explain why you wish to study in the academic areas you selected.', 150),
  p('rice', 2, 'why_school', 'Based upon your exploration of Rice University, what elements of the Rice experience appeal to you?', 150),
  p('rice', 3, 'community', 'Rice is strengthened by its diverse community of learning and discovery that produces leaders and change agents across the spectrum of human endeavor. What perspectives shaped by your background, experiences, upbringing, and/or racial identity inspire you to join our community of change agents at Rice?', 500),

  // WashU
  p('washu', 1, 'why_major', 'Please tell us what you are interested in studying at college and why.', 200),
  p('washu', 2, 'community', 'WashU strives to know every undergraduate student by name and story. Tell us a story about you — one that reflects a part of who you are that is important for us to know.', 250),

  // UMich
  p('umich', 1, 'community', 'Everyone belongs to many different communities and/or groups defined by (among other things) shared geography, religion, ethnicity, income, cuisine, interest, race, ideology, or intellectual heritage. Choose one of the communities to which you belong, and describe that community and your place within it.', 300),
  p('umich', 2, 'why_school', 'Describe the unique qualities that attract you to the specific undergraduate College or School (including preferred admission and dual degree programs) to which you are applying at the University of Michigan. How would that curriculum support your interests?', 550, { programId: 'per_school' }),

  // UT Austin
  p('utaustin', 1, 'why_major', 'Why are you interested in the major you indicated as your first-choice major?', 300, { applicationRound: 'ALL' }),
  p('utaustin', 2, 'identity', 'Think of all the activities — both in and outside of school — that you have been involved with during high school. Which one are you most proud of and why?', 300),
  p('utaustin', 3, 'identity', 'Please share how you believe your experiences, perspectives, and/or talents have shaped your ability to contribute to and enrich the learning environment at UT Austin, both in and out of the classroom.', 300),

  // UC schools — PIQs (stable, choose 4 of 8)
  ...ucPiqs('berkeley'),
  ...ucPiqs('ucla'),
  ...ucPiqs('ucsd'),
];

export function promptsForSchool(schoolId: string): EssayPrompt[] {
  return ESSAY_PROMPT_LIBRARY.filter(pr => pr.schoolId === schoolId);
}

export function getPrompt(id: string): EssayPrompt | undefined {
  return ESSAY_PROMPT_LIBRARY.find(pr => pr.id === id);
}

/** Schools covered by the seeded library (for the picker; others use custom prompts). */
export const LIBRARY_SCHOOL_IDS: string[] = [...new Set(ESSAY_PROMPT_LIBRARY.map(pr => pr.schoolId))];
