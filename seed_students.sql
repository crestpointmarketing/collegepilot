-- Run this in Supabase Dashboard → SQL Editor
-- Seeds all sample students under vivianxie30@gmail.com

DO $outer$
DECLARE
  v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'vivianxie30@gmail.com' LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User vivianxie30@gmail.com not found in auth.users';
  END IF;

  INSERT INTO public.students (id, user_id, data, updated_at) VALUES
  (
    's7', v_uid,
    $j0${"id":"s7","name":"Ethan Li","grade":12,"school":"Highland Park High School","city":"Dallas, TX","major":"Computer Science / AI Systems","secondary":"Mathematics","gpa":"4.459","gpaType":"Weighted","sat":"1540","act":"","apCount":6,"strengths":["AI/ML Systems","Competitive Programming","Full-Stack Engineering","Research & Innovation"],"weak":["SAT below top-10 median","Limited humanities depth","No published research paper"],"citizenship":"U.S. Citizen","schoolType":"Public","competitiveness":"Very Competitive","firstGen":"No","targetRange":"Top 10","risk":"Balanced","preferred":"MIT, Stanford, CMU, Caltech","traits":"AI Systems Builder with production-scale deployments across speech processing, financial reasoning, and human-AI interaction. Built Whisper→LLM→XTTS speech therapy pipeline achieving 46% fluency improvement. USACO Gold Division. 100+ volunteer service hours.","angles":"Three deployed AI systems targeting real-world problems; USACO Gold via perfect-score promotion; science fair winner with societal impact framing (pediatric speech therapy accessibility)","color":"#0ea5e9","status":"Draft","updated":"Apr 2026","activities":[{"id":"a1","category":"Research","position":"Founder & Lead Developer","org":"SpeakWise","desc":"Built multi-stage neural speech repair system (Whisper→LLM→XTTS); 46% fluency improvement, 95%+ stutter reduction targeting pediatric accessibility","grades":[11,12],"timing":"School Year, Summer","hours":15,"weeks":40},{"id":"a2","category":"Internship","position":"Software Engineer Intern","org":"Eelocutionist","desc":"Built production AI interview coaching platform with Express.js + LLM evaluation, speech APIs, and multi-format interview engine deployed to live users","grades":[11,12],"timing":"School Year, Summer","hours":10,"weeks":36},{"id":"a3","category":"Research","position":"Independent Developer","org":"Zeitgeist (Independent Project)","desc":"Built real-time AI system for financial reasoning under uncertainty; integrated Polygon.io options data with LLM interpretation via FastAPI + Docker","grades":[11,12],"timing":"School Year, Summer","hours":8,"weeks":30},{"id":"a4","category":"Science/Math","position":"Gold Division Competitor","org":"USA Computing Olympiad (USACO)","desc":"Achieved Gold Division via perfect-score promotion from Silver; competitive programming in C++ and Python through LeetCode and Codeforces","grades":[10,11,12],"timing":"School Year","hours":5,"weeks":36},{"id":"a5","category":"Community Service (Volunteer)","position":"Volunteer","org":"Multiple Community Organizations","desc":"Completed 100+ hours of community service earning Gold President’s Volunteer Service Award and International Service Honor Recognition (Gold)","grades":[10,11,12],"timing":"School Year, Summer","hours":4,"weeks":30},{"id":"a6","category":"Cultural","position":"Member, CS Chapter","org":"Asian Culture and Education Society USA","desc":"Youth Board of Governors, Computer Science Chapter; leadership in student technical and cultural organizations","grades":[11,12],"timing":"School Year","hours":3,"weeks":36}],"awards":[{"id":"w1","title":"USACO Gold Division","grade":11,"level":"National"},{"id":"w2","title":"HPHS SciTech Fair — 1st Place & Jay Ingram Award (SpeakWise)","grade":11,"level":"School"},{"id":"w3","title":"Dallas Regional Science & Engineering Fair (DRSEF) — Honorable Mention, Top 4","grade":11,"level":"Regional"},{"id":"w4","title":"President’s Volunteer Service Award — Gold (100+ hrs)","grade":11,"level":"National"},{"id":"w5","title":"International Service Honor Recognition — Gold Award","grade":11,"level":"National"},{"id":"w6","title":"Scholastic Writing Awards — Regional Silver Key","grade":11,"level":"Regional"},{"id":"w7","title":"CTY Johns Hopkins Talent Search — Advanced Level Qualification","grade":10,"level":"National"}]}$j0$::jsonb,
    now()
  ),
  (
    's1', v_uid,
    $j1${"id":"s1","name":"Aarav Patel","grade":11,"school":"Mission San Jose High School","city":"Fremont, CA","major":"Computer Science","secondary":"Mathematics","gpa":"4.62","gpaType":"Weighted","sat":"1560","act":"","apCount":11,"strengths":["Mathematics","Computer Science","Physics"],"weak":[],"citizenship":"U.S. Citizen","schoolType":"Public","competitiveness":"Top","firstGen":"No","targetRange":"Top 10","risk":"Aggressive","preferred":"MIT, Stanford, CMU, UC Berkeley","traits":"Independent researcher, deeply curious, builds end-to-end systems. Prefers depth over breadth.","angles":"Self-taught ML researcher who shipped a published arXiv preprint in 11th grade. Built a tutoring nonprofit reaching 400+ students in underserved Bay Area districts.","color":"#6366f1","status":"Strategy Generated","updated":"2 hours ago","activities":[{"id":"a1","category":"Academic","position":"Founder & Lead Researcher","org":"Riemann ML Lab (independent)","desc":"Published arXiv preprint on transformer interpretability; cited 12x. Mentored 6 peers in research methodology.","grades":[10,11],"timing":"All Year","hours":15,"weeks":40},{"id":"a2","category":"Computer/Technology","position":"Founder, Executive Director","org":"CodeForward Tutoring","desc":"Built 501(c)(3) serving 400+ students across 8 Title I schools. Raised $32K in grants; led team of 24 tutors.","grades":[10,11],"timing":"All Year","hours":8,"weeks":38},{"id":"a3","category":"Science/Math","position":"USAMO Qualifier","org":"Mathematical Association of America","desc":"Top 250 nationally on AIME (score: 12). USAMO qualifier 2025. Member of school’s #1-ranked AMC team.","grades":[10,11],"timing":"All Year","hours":6,"weeks":30}],"awards":[{"id":"w1","title":"USAMO Qualifier (Top 250 nationally)","grade":11,"level":"National"},{"id":"w2","title":"Regeneron STS Semifinalist","grade":11,"level":"National"},{"id":"w3","title":"Coca-Cola Scholar Semifinalist","grade":11,"level":"National"}]}$j1$::jsonb,
    now()
  ),
  (
    's2', v_uid,
    $j2${"id":"s2","name":"Sofia Reyes","grade":12,"school":"Stuyvesant High School","city":"New York, NY","major":"Bioengineering","secondary":"Public Health","gpa":"3.97","gpaType":"Unweighted","sat":"1540","act":"","apCount":9,"strengths":["Biology","Chemistry","Spanish"],"weak":["Physics"],"citizenship":"U.S. Citizen","schoolType":"Public","competitiveness":"Top","firstGen":"Yes","targetRange":"Top 20","risk":"Balanced","preferred":"Johns Hopkins, Duke, Rice, UT Austin","traits":"","angles":"","color":"#ec4899","status":"Document Ready","updated":"Yesterday","activities":[],"awards":[]}$j2$::jsonb,
    now()
  ),
  (
    's3', v_uid,
    $j3${"id":"s3","name":"Marcus Chen","grade":11,"school":"Thomas Jefferson HSST","city":"Alexandria, VA","major":"Electrical Engineering","secondary":"Robotics","gpa":"4.48","gpaType":"Weighted","sat":"1520","act":"34","apCount":8,"strengths":["Physics","Mathematics"],"weak":[],"citizenship":"U.S. Citizen","schoolType":"Public","competitiveness":"Top","firstGen":"No","targetRange":"Top 10","risk":"Balanced","preferred":"MIT, Caltech, Georgia Tech","traits":"","angles":"","color":"#0891b2","status":"Draft","updated":"3 days ago","activities":[],"awards":[]}$j3$::jsonb,
    now()
  ),
  (
    's4', v_uid,
    $j4${"id":"s4","name":"Priya Krishnan","grade":11,"school":"Phillips Exeter Academy","city":"Exeter, NH","major":"Economics","secondary":"Statistics","gpa":"3.92","gpaType":"Unweighted","sat":"1570","act":"","apCount":0,"strengths":["Economics","Statistics","Writing"],"weak":[],"citizenship":"U.S. Citizen","schoolType":"Private","competitiveness":"Top","firstGen":"No","targetRange":"Top 10","risk":"Aggressive","preferred":"Harvard, Stanford, Princeton, Yale","traits":"","angles":"","color":"#7c3aed","status":"Strategy Generated","updated":"5 days ago","activities":[],"awards":[]}$j4$::jsonb,
    now()
  ),
  (
    's5', v_uid,
    $j5${"id":"s5","name":"Daniel Okafor","grade":12,"school":"Lincoln Park High School","city":"Chicago, IL","major":"Mechanical Engineering","secondary":"","gpa":"4.31","gpaType":"Weighted","sat":"1490","act":"","apCount":7,"strengths":["Engineering","Physics"],"weak":[],"citizenship":"U.S. Citizen","schoolType":"Public","competitiveness":"Average","firstGen":"Yes","targetRange":"Top 20","risk":"Conservative","preferred":"Georgia Tech, UIUC, Purdue","traits":"","angles":"","color":"#059669","status":"Document Ready","updated":"1 week ago","activities":[],"awards":[]}$j5$::jsonb,
    now()
  )
  ON CONFLICT (id, user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();

  RAISE NOTICE 'Done — seeded 6 students for vivianxie30@gmail.com (uid: %)', v_uid;
END $outer$;
