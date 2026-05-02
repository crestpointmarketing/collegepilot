-- Run this in Supabase Dashboard → SQL Editor
-- Upserts Ethan Li's full profile under vivianxie30@gmail.com

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
    $j0${
      "id": "s7",
      "name": "Ethan Li",
      "grade": 11,
      "school": "Highland Park High School",
      "city": "Dallas, TX",
      "major": "Computer Science / AI Systems",
      "secondary": "Mathematics",
      "gpa": "4.459",
      "gpaType": "Weighted",
      "sat": "1540",
      "act": "",
      "apCount": 13,
      "strengths": ["AI/ML Systems", "Competitive Programming", "Full-Stack Engineering", "Research & Innovation"],
      "weak": ["SAT below top-10 median", "Limited humanities depth"],
      "citizenship": "U.S. Citizen",
      "schoolType": "Public",
      "competitiveness": "Very Competitive",
      "firstGen": "No",
      "targetRange": "Top 10",
      "risk": "Balanced",
      "preferred": "MIT, Stanford, CMU, Caltech",
      "traits": "AI Systems Builder with production-scale deployments across speech processing, financial reasoning, and human-AI interaction. Built Whisper→LLM→XTTS speech therapy pipeline achieving 46% fluency improvement. USACO Gold Division (promoted from Silver via perfect score). 100+ volunteer service hours. PSAT/NMSQT National Merit Commended Scholar. Python IT Specialist Certification.",
      "angles": "Three deployed AI systems targeting real-world problems (healthcare, career coaching, finance); USACO Gold via perfect-score promotion; science fair winner with societal impact framing (pediatric speech therapy accessibility). National Merit Commended Scholar.",
      "color": "#0ea5e9",
      "status": "Draft",
      "updated": "May 2026",
      "activities": [
        {
          "id": "a1",
          "category": "Research",
          "position": "Founder & Lead Developer",
          "org": "SpeakWise",
          "desc": "Built Whisper→LLM→XTTS neural speech therapy pipeline; 46% fluency improvement, 95%+ stutter reduction; real-time streaming; 1st Place + Jay Ingram Award (HPHS SciTech Fair); Top 4 DRSEF",
          "grades": [11, 12],
          "timing": "School Year, Summer",
          "hours": 15,
          "weeks": 40
        },
        {
          "id": "a2",
          "category": "Internship",
          "position": "Software Engineer Intern",
          "org": "Elocutionist",
          "desc": "Built production AI interview coaching platform; WebSocket + LLM evaluation; multi-format engine (behavioral/technical/case); live user deployment; performance analytics dashboard",
          "grades": [11, 12],
          "timing": "School Year, Summer",
          "hours": 10,
          "weeks": 36
        },
        {
          "id": "a3",
          "category": "Research",
          "position": "Independent Developer",
          "org": "Zeitgeist (Independent Project)",
          "desc": "Built real-time AI financial reasoning system; Polygon.io live data + LLM interpretation; FastAPI + Docker; probabilistic confidence-aware outputs under market uncertainty",
          "grades": [11, 12],
          "timing": "School Year, Summer",
          "hours": 8,
          "weeks": 30
        },
        {
          "id": "a4",
          "category": "Science/Math",
          "position": "Gold Division Competitor",
          "org": "USA Computing Olympiad (USACO)",
          "desc": "Achieved Gold Division via perfect-score promotion from Silver; competitive programming in C++ and Python; active on LeetCode and Codeforces",
          "grades": [10, 11, 12],
          "timing": "School Year",
          "hours": 5,
          "weeks": 36
        },
        {
          "id": "a5",
          "category": "Community Service (Volunteer)",
          "position": "Volunteer",
          "org": "Multiple Community Organizations",
          "desc": "Completed 100+ hours of community service earning Gold President's Volunteer Service Award and International Service Honor Recognition (Gold)",
          "grades": [10, 11, 12],
          "timing": "School Year, Summer",
          "hours": 4,
          "weeks": 30
        },
        {
          "id": "a6",
          "category": "Cultural",
          "position": "Member, CS Chapter",
          "org": "Asian Culture and Education Society USA",
          "desc": "Youth Board of Governors, Computer Science Chapter; leadership in student technical and cultural organizations",
          "grades": [11, 12],
          "timing": "School Year",
          "hours": 3,
          "weeks": 36
        }
      ],
      "awards": [
        {"id": "w1", "title": "USACO Gold Division", "grade": 11, "level": "National"},
        {"id": "w2", "title": "HPHS SciTech Fair — 1st Place & Jay Ingram Award (SpeakWise)", "grade": 11, "level": "School"},
        {"id": "w3", "title": "Dallas Regional Science & Engineering Fair (DRSEF) — Honorable Mention, Top 4", "grade": 11, "level": "Regional"},
        {"id": "w4", "title": "President's Volunteer Service Award — Gold (100+ hrs)", "grade": 11, "level": "National"},
        {"id": "w5", "title": "International Service Honor Recognition — Gold Award", "grade": 11, "level": "National"},
        {"id": "w6", "title": "Scholastic Writing Awards — Regional Silver Key", "grade": 11, "level": "Regional"},
        {"id": "w7", "title": "CTY Johns Hopkins Talent Search — Advanced Level Qualification", "grade": 10, "level": "National"},
        {"id": "w8", "title": "PSAT/NMSQT — National Merit Commended Scholar", "grade": 11, "level": "National"},
        {"id": "w9", "title": "Python IT Specialist Certification (CompTIA/Certiport)", "grade": 11, "level": "National"}
      ],
      "courses": [
        {"id": "c1",  "name": "English 1",               "level": "Honors", "grade": "91", "year": 9},
        {"id": "c2",  "name": "Algebra 2",                "level": "Honors", "grade": "90", "year": 9},
        {"id": "c3",  "name": "Biology",                  "level": "Honors", "grade": "93", "year": 9},
        {"id": "c4",  "name": "Chemistry",                "level": "Honors", "grade": "91", "year": 9},
        {"id": "c5",  "name": "World Geography",          "level": "Honors", "grade": "95", "year": 9},
        {"id": "c6",  "name": "Latin 1",                  "level": "Honors", "grade": "94", "year": 9},
        {"id": "c7",  "name": "Art 1",                    "level": "Regular","grade": "94", "year": 9},
        {"id": "c8",  "name": "English 2",                "level": "Honors", "grade": "96", "year": 10},
        {"id": "c9",  "name": "AP Calculus AB",           "level": "AP",     "grade": "88", "year": 10},
        {"id": "c10", "name": "Pre-Calculus",             "level": "Regular","grade": "92", "year": 10},
        {"id": "c11", "name": "AP Biology",               "level": "AP",     "grade": "93", "year": 10},
        {"id": "c12", "name": "AP Chemistry",             "level": "AP",     "grade": "95", "year": 10},
        {"id": "c13", "name": "AP World History",         "level": "AP",     "grade": "91", "year": 10},
        {"id": "c14", "name": "Latin 2",                  "level": "Honors", "grade": "93", "year": 10},
        {"id": "c15", "name": "Latin 3",                  "level": "Honors", "grade": "96", "year": 10},
        {"id": "c16", "name": "AP CS Principles",         "level": "AP",     "grade": "98", "year": 10},
        {"id": "c17", "name": "AP English Language",      "level": "AP",     "grade": "94", "year": 11},
        {"id": "c18", "name": "AP Calculus BC",           "level": "AP",     "grade": "93", "year": 11},
        {"id": "c19", "name": "AP Statistics",            "level": "AP",     "grade": "97", "year": 11},
        {"id": "c20", "name": "AP Physics C: E&M",        "level": "AP",     "grade": "95", "year": 11},
        {"id": "c21", "name": "AP Physics C: Mechanics",  "level": "AP",     "grade": "95", "year": 11},
        {"id": "c22", "name": "AP US History",            "level": "AP",     "grade": "94", "year": 11},
        {"id": "c23", "name": "AP Latin",                 "level": "AP",     "grade": "96", "year": 11},
        {"id": "c24", "name": "AP Computer Science A",    "level": "AP",     "grade": "93", "year": 11}
      ]
    }$j0$::jsonb,
    now()
  )
  ON CONFLICT (id, user_id) DO UPDATE
    SET data = EXCLUDED.data,
        updated_at = now();

  RAISE NOTICE 'Done — Ethan Li profile upserted for vivianxie30@gmail.com (uid: %)', v_uid;
END $outer$;
