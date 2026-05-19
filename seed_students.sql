-- Run this in Supabase Dashboard → SQL Editor
-- Upserts ALL sample student profiles under vivianxie30@gmail.com

DO $outer$
DECLARE
  v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'vivianxie30@gmail.com' LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User vivianxie30@gmail.com not found in auth.users';
  END IF;

  -- ── s7: Ethan Li ────────────────────────────────────────────
  INSERT INTO public.students (id, user_id, data, updated_at) VALUES
  (
    's7', v_uid,
    $j7${
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
      "traits": "AI Systems Builder with production-scale deployments across speech processing, financial reasoning, and human-AI interaction. Built Whisper→LLM→XTTS speech therapy pipeline (SpeakWise) achieving 46% fluency improvement, published at HPHS SciTech Fair and DRSEF; submitting to Regeneron STS 2026 and S.-T. Yau High School Science Award. USACO Gold Division (perfect-score promotion from Silver). National Merit Commended Scholar. Python IT Specialist Certification.",
      "angles": "Publishable research with measurable societal impact (SpeakWise targets 1.2M+ children/yr, $154B–$186B annual burden); STS + Yau submission signals serious research identity. Three deployed AI systems (healthcare, career coaching, finance). USACO Gold via perfect-score promotion. National Merit Commended Scholar. Narrative arc: CS as a tool for equity and accessibility.",
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
        {"id": "w6", "title": "Scholastic Writing Awards — Regional Silver Key", "grade": 9, "level": "Regional"},
        {"id": "w7", "title": "CTY Johns Hopkins Talent Search — Advanced Level Qualification", "grade": 10, "level": "National"},
        {"id": "w8", "title": "PSAT/NMSQT — National Merit Commended Scholar", "grade": 11, "level": "National"},
        {"id": "w9", "title": "Python IT Specialist Certification (CompTIA/Certiport)", "grade": 11, "level": "National"},
        {"id": "w10", "title": "DRSEF (Dallas Regional Science & Engineering Fair) — Top 4 / Honorable Mention (SpeakWise)", "grade": 11, "level": "Regional"}
      ],
      "projects": [
        {
          "id": "p1",
          "name": "SpeakWise: AI-Assisted Limited Repair Platform for Children with Language Disorders",
          "field": "CS / AI / Speech Technology",
          "type": "Research",
          "description": "End-to-end pipeline: OpenAI Whisper ASR → Google Gemini 2.0 LLM linguistic repair → XTTS v2 zero-shot voice cloning. Introduced Repair Intensity Parameter (λ=0–1) as tunable fluency-identity tradeoff controller. Evaluated on UCLASS corpus (N=40 pediatric speech samples). At λ=0.6: 46% fluency improvement, BERTScore >0.95 (semantic fidelity preserved), 100% stutter block reduction, speech rate +110%. Web-based Gradio interface with side-by-side spectrogram analysis for SLP augmentation.",
          "outcome": "1st Place + Jay Ingram Award (HPHS SciTech Fair 2025); Top 4 / Honorable Mention DRSEF; submitting to Regeneron STS 2026 and S.-T. Yau High School Science Award",
          "affiliation": "Highland Park High School (Independent Research)",
          "impact": "Targets 1.2M+ US children diagnosed with speech/language disorders annually; addresses $154B–$186B annual societal cost of untreated speech disorders; low-cost SLP augmentation tool bridging Digital Divide in pediatric speech technology"
        }
      ],
      "courses": [
        {"id": "c1",  "name": "English 1",               "level": "Honors", "gradeSem1": "91", "gradeSem2": "91", "year": 9},
        {"id": "c2",  "name": "Algebra 2",                "level": "Honors", "gradeSem1": "90", "gradeSem2": "90", "year": 9},
        {"id": "c3",  "name": "Biology",                  "level": "Honors", "gradeSem1": "93", "gradeSem2": "93", "year": 9},
        {"id": "c4",  "name": "Chemistry",                "level": "Honors", "gradeSem1": "91", "gradeSem2": "91", "year": 9},
        {"id": "c5",  "name": "World Geography",          "level": "Honors", "gradeSem1": "95", "gradeSem2": "95", "year": 9},
        {"id": "c6",  "name": "Latin 1",                  "level": "Honors", "gradeSem1": "94", "gradeSem2": "94", "year": 9},
        {"id": "c7",  "name": "Art 1",                    "level": "Regular","gradeSem1": "94", "gradeSem2": "94", "year": 9},
        {"id": "c8",  "name": "English 2",                "level": "Honors", "gradeSem1": "96", "gradeSem2": "96", "year": 10},
        {"id": "c9",  "name": "AP Calculus AB",           "level": "AP",     "gradeSem1": "88", "gradeSem2": "88", "year": 10, "apScore": 5},
        {"id": "c10", "name": "Pre-Calculus",             "level": "Regular","gradeSem1": "92", "gradeSem2": "92", "year": 10},
        {"id": "c11", "name": "AP Biology",               "level": "AP",     "gradeSem1": "93", "gradeSem2": "93", "year": 10, "apScore": 5},
        {"id": "c12", "name": "AP Chemistry",             "level": "AP",     "gradeSem1": "95", "gradeSem2": "95", "year": 10, "apScore": 5},
        {"id": "c13", "name": "AP World History",         "level": "AP",     "gradeSem1": "91", "gradeSem2": "91", "year": 10, "apScore": 4},
        {"id": "c14", "name": "Latin 2",                  "level": "Honors", "gradeSem1": "93", "gradeSem2": "93", "year": 10},
        {"id": "c15", "name": "Latin 3",                  "level": "Honors", "gradeSem1": "96", "gradeSem2": "96", "year": 10},
        {"id": "c16", "name": "AP CS Principles",         "level": "AP",     "gradeSem1": "98", "gradeSem2": "98", "year": 10, "apScore": 5},
        {"id": "c17", "name": "AP English Language",      "level": "AP",     "gradeSem1": "94", "gradeSem2": "94", "year": 11, "apScore": 4},
        {"id": "c18", "name": "AP Calculus BC",           "level": "AP",     "gradeSem1": "93", "gradeSem2": "93", "year": 11, "apScore": 5},
        {"id": "c19", "name": "AP Statistics",            "level": "AP",     "gradeSem1": "97", "gradeSem2": "97", "year": 11, "apScore": 5},
        {"id": "c20", "name": "AP Physics C: E&M",        "level": "AP",     "gradeSem1": "95", "gradeSem2": "95", "year": 11, "apScore": 5},
        {"id": "c21", "name": "AP Physics C: Mechanics",  "level": "AP",     "gradeSem1": "95", "gradeSem2": "95", "year": 11, "apScore": 5},
        {"id": "c22", "name": "AP US History",            "level": "AP",     "gradeSem1": "94", "gradeSem2": "94", "year": 11, "apScore": 4},
        {"id": "c23", "name": "AP Latin",                 "level": "AP",     "gradeSem1": "96", "gradeSem2": "96", "year": 11, "apScore": 5},
        {"id": "c24", "name": "AP Computer Science A",    "level": "AP",     "gradeSem1": "93", "gradeSem2": "93", "year": 11, "apScore": 5}
      ]
    }$j7$::jsonb,
    now()
  )
  ON CONFLICT (id, user_id) DO UPDATE
    SET data = EXCLUDED.data,
        updated_at = now();

  -- ── s1: Aarav Patel ─────────────────────────────────────────
  INSERT INTO public.students (id, user_id, data, updated_at) VALUES
  (
    's1', v_uid,
    $j1${
      "id": "s1",
      "name": "Aarav Patel",
      "grade": 11,
      "school": "Mission San Jose High School",
      "city": "Fremont, CA",
      "major": "Computer Science",
      "secondary": "Mathematics",
      "gpa": "4.62",
      "gpaType": "Weighted",
      "sat": "1560",
      "act": "",
      "apCount": 11,
      "strengths": ["Mathematics", "Computer Science", "Physics"],
      "weak": [],
      "citizenship": "U.S. Citizen",
      "schoolType": "Public",
      "competitiveness": "Top",
      "firstGen": "No",
      "targetRange": "Top 10",
      "risk": "Aggressive",
      "preferred": "MIT, Stanford, CMU, UC Berkeley",
      "traits": "Independent researcher, deeply curious, builds end-to-end systems. Prefers depth over breadth.",
      "angles": "Self-taught ML researcher who shipped a published arXiv preprint in 11th grade. Built a tutoring nonprofit reaching 400+ students in underserved Bay Area districts.",
      "color": "#6366f1",
      "status": "Strategy Generated",
      "updated": "2 hours ago",
      "activities": [
        {
          "id": "a1",
          "category": "Academic",
          "position": "Founder & Lead Researcher",
          "org": "Riemann ML Lab (independent)",
          "desc": "Published arXiv preprint on transformer interpretability; cited 12x. Mentored 6 peers in research methodology.",
          "grades": [10, 11],
          "timing": "All Year",
          "hours": 15,
          "weeks": 40
        },
        {
          "id": "a2",
          "category": "Computer/Technology",
          "position": "Founder, Executive Director",
          "org": "CodeForward Tutoring",
          "desc": "Built 501(c)(3) serving 400+ students across 8 Title I schools. Raised $32K in grants; led team of 24 tutors.",
          "grades": [10, 11],
          "timing": "All Year",
          "hours": 8,
          "weeks": 38
        },
        {
          "id": "a3",
          "category": "Science/Math",
          "position": "USAMO Qualifier",
          "org": "Mathematical Association of America",
          "desc": "Top 250 nationally on AIME (score: 12). USAMO qualifier 2025. Member of school's #1-ranked AMC team.",
          "grades": [10, 11],
          "timing": "All Year",
          "hours": 6,
          "weeks": 30
        }
      ],
      "awards": [
        {"id": "w1", "title": "USAMO Qualifier (Top 250 nationally)", "grade": 11, "level": "National"},
        {"id": "w2", "title": "Regeneron STS Semifinalist", "grade": 11, "level": "National"},
        {"id": "w3", "title": "Coca-Cola Scholar Semifinalist", "grade": 11, "level": "National"}
      ]
    }$j1$::jsonb,
    now()
  )
  ON CONFLICT (id, user_id) DO UPDATE
    SET data = EXCLUDED.data,
        updated_at = now();

  -- ── s2: Sofia Reyes ─────────────────────────────────────────
  INSERT INTO public.students (id, user_id, data, updated_at) VALUES
  (
    's2', v_uid,
    $j2${
      "id": "s2",
      "name": "Sofia Reyes",
      "grade": 12,
      "school": "Stuyvesant High School",
      "city": "New York, NY",
      "major": "Bioengineering",
      "secondary": "Public Health",
      "gpa": "3.97",
      "gpaType": "Unweighted",
      "sat": "1540",
      "act": "",
      "apCount": 9,
      "strengths": ["Biology", "Chemistry", "Spanish"],
      "weak": ["Physics"],
      "citizenship": "U.S. Citizen",
      "schoolType": "Public",
      "competitiveness": "Top",
      "firstGen": "Yes",
      "targetRange": "Top 20",
      "risk": "Balanced",
      "preferred": "Johns Hopkins, Duke, Rice, UT Austin",
      "traits": "",
      "angles": "",
      "color": "#ec4899",
      "status": "Document Ready",
      "updated": "Yesterday",
      "activities": [],
      "awards": []
    }$j2$::jsonb,
    now()
  )
  ON CONFLICT (id, user_id) DO UPDATE
    SET data = EXCLUDED.data,
        updated_at = now();

  -- ── s3: Marcus Chen ─────────────────────────────────────────
  INSERT INTO public.students (id, user_id, data, updated_at) VALUES
  (
    's3', v_uid,
    $j3${
      "id": "s3",
      "name": "Marcus Chen",
      "grade": 11,
      "school": "Thomas Jefferson HSST",
      "city": "Alexandria, VA",
      "major": "Electrical Engineering",
      "secondary": "Robotics",
      "gpa": "4.48",
      "gpaType": "Weighted",
      "sat": "1520",
      "act": "34",
      "apCount": 8,
      "strengths": ["Physics", "Mathematics"],
      "weak": [],
      "citizenship": "U.S. Citizen",
      "schoolType": "Public",
      "competitiveness": "Top",
      "firstGen": "No",
      "targetRange": "Top 10",
      "risk": "Balanced",
      "preferred": "MIT, Caltech, Georgia Tech",
      "traits": "",
      "angles": "",
      "color": "#0891b2",
      "status": "Draft",
      "updated": "3 days ago",
      "activities": [],
      "awards": []
    }$j3$::jsonb,
    now()
  )
  ON CONFLICT (id, user_id) DO UPDATE
    SET data = EXCLUDED.data,
        updated_at = now();

  -- ── s4: Priya Krishnan ──────────────────────────────────────
  INSERT INTO public.students (id, user_id, data, updated_at) VALUES
  (
    's4', v_uid,
    $j4${
      "id": "s4",
      "name": "Priya Krishnan",
      "grade": 11,
      "school": "Phillips Exeter Academy",
      "city": "Exeter, NH",
      "major": "Economics",
      "secondary": "Statistics",
      "gpa": "3.92",
      "gpaType": "Unweighted",
      "sat": "1570",
      "act": "",
      "apCount": 0,
      "strengths": ["Economics", "Statistics", "Writing"],
      "weak": [],
      "citizenship": "U.S. Citizen",
      "schoolType": "Private",
      "competitiveness": "Top",
      "firstGen": "No",
      "targetRange": "Top 10",
      "risk": "Aggressive",
      "preferred": "Harvard, Stanford, Princeton, Yale",
      "traits": "",
      "angles": "",
      "color": "#7c3aed",
      "status": "Strategy Generated",
      "updated": "5 days ago",
      "activities": [],
      "awards": []
    }$j4$::jsonb,
    now()
  )
  ON CONFLICT (id, user_id) DO UPDATE
    SET data = EXCLUDED.data,
        updated_at = now();

  -- ── s5: Daniel Okafor ───────────────────────────────────────
  INSERT INTO public.students (id, user_id, data, updated_at) VALUES
  (
    's5', v_uid,
    $j5${
      "id": "s5",
      "name": "Daniel Okafor",
      "grade": 12,
      "school": "Lincoln Park High School",
      "city": "Chicago, IL",
      "major": "Mechanical Engineering",
      "secondary": "",
      "gpa": "4.31",
      "gpaType": "Weighted",
      "sat": "1490",
      "act": "",
      "apCount": 7,
      "strengths": ["Engineering", "Physics"],
      "weak": [],
      "citizenship": "U.S. Citizen",
      "schoolType": "Public",
      "competitiveness": "Average",
      "firstGen": "Yes",
      "targetRange": "Top 20",
      "risk": "Conservative",
      "preferred": "Georgia Tech, UIUC, Purdue",
      "traits": "",
      "angles": "",
      "color": "#059669",
      "status": "Document Ready",
      "updated": "1 week ago",
      "activities": [],
      "awards": []
    }$j5$::jsonb,
    now()
  )
  ON CONFLICT (id, user_id) DO UPDATE
    SET data = EXCLUDED.data,
        updated_at = now();

  RAISE NOTICE 'Done — 6 student profiles upserted for vivianxie30@gmail.com (uid: %)', v_uid;
END $outer$;
