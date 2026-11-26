import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bookmark, CheckCircle2, Pause, Play, Repeat, RotateCcw, ShieldPlus, Timer } from 'lucide-react';
import { ALL_SURAHS, SurahMeta } from '../data/surahIndex';

export interface QuranState {
  pagesRead: number;
  targetDays: number;
  lastSurahId: number;
  bookmarks: number[];
}

interface SurahItem {
  id: number;
  nameAr: string;
  nameBn: string;
  verses: number;
  place: 'মাক্কী' | 'মাদানী';
  ayahs: { ar: string; bn: string }[];
}

const OFFLINE_SURAHS: SurahItem[] = [
  {
    id: 1,
    nameAr: 'سورة الفاتحة',
    nameBn: 'সূরা আল-ফাতিহা',
    verses: 7,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', bn: 'পরম করুণাময় অসীম দয়ালু আল্লাহর নামে।' },
      { ar: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', bn: 'সকল প্রশংসা জগতসমূহের প্রতিপালক আল্লাহর জন্য।' },
      { ar: 'الرَّحْمَٰنِ الرَّحِيمِ', bn: 'যিনি পরম করুণাময়, অতি দয়ালু।' },
      { ar: 'مَالِكِ يَوْمِ الدِّينِ', bn: 'বিচার দিনের মালিক।' },
      { ar: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', bn: 'আমরা কেবল আপনারই ইবাদত করি এবং কেবল আপনারই সাহায্য চাই।' },
      { ar: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', bn: 'আমাদেরকে সরল পথ প্রদর্শন করুন।' },
      { ar: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', bn: 'তাদের পথ, যাদেরকে আপনি নেয়ামত দিয়েছেন; তাদের পথ নয় যারা অভিশপ্ত ও পথভ্রষ্ট হয়েছে।' },
    ],
  },
  {
    id: 2,
    nameAr: 'آية الكرسي (٢٥٥)',
    nameBn: 'আয়াতুল কুরসী (বাকারা: ২৫৫)',
    verses: 1,
    place: 'মাদানী',
    ayahs: [
      {
        ar: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
        bn: 'আল্লাহ, তিনি ছাড়া কোনো উপাস্য নেই। তিনি চিরঞ্জীব, সবকিছুর ধারক। তন্দ্রা ও নিদ্রা তাঁকে স্পর্শ করে না। আসমান ও জমিনে যা কিছু আছে সব তাঁরই। তাঁর কুরসী আসমান ও জমিনকে পরিবেষ্টন করে আছে। তিনিই সর্বোচ্চ, মহান।',
      },
    ],
  },
  {
    id: 18,
    nameAr: 'أول سورة الكهف',
    nameBn: 'সূরা কাহাফ (প্রথম ১০ আয়াত)',
    verses: 10,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'الْحَمْدُ لِلَّهِ الَّذِي أَنزَلَ عَلَىٰ عَبْدِهِ الْكِتَابَ وَلَمْ يَجْعَل لَّهُ عِوَجَا ۜ', bn: 'সকল প্রশংসা আল্লাহর, যিনি তাঁর বান্দার প্রতি কিতাব নাজিল করেছেন এবং তাতে কোনো বক্রতা রাখেননি।' },
      { ar: 'قَيِّمًا لِّيُنذِرَ بَأْسًا شَدِيدًا مِّن لَّدُنْهُ وَيُبَشِّرَ الْمُؤْمِنِينَ الَّذِينَ يَعْمَلُونَ الصَّالِحَاتِ أَنَّ لَهُمْ أَجْرًا حَسَنًا', bn: 'সুপ্রতিষ্ঠিত রূপে, যাতে তিনি তাঁর পক্ষ থেকে কঠিন শাস্তির সতর্কবাণী শোনান এবং সৎকর্মশীল মুমিনদের সুসংবাদ দেন যে তাদের জন্য উত্তম প্রতিদান রয়েছে।' },
      { ar: 'مَّاكِثِينَ فِيهِ أَبَدًا', bn: 'যেখানে তারা চিরকাল থাকবে।' },
      { ar: 'وَيُنذِرَ الَّذِينَ قَالُوا اتَّخَذَ اللَّهُ وَلَدًا', bn: 'এবং তাদেরকে সতর্ক করেন যারা বলে, আল্লাহ সন্তান গ্রহণ করেছেন।' },
      { ar: 'مَّا لَهُم بِهِ مِنْ عِلْمٍ وَلَا لِآبَائِهِمْ ۚ كَبُرَتْ كَلِمَةً تَخْرُجُ مِنْ أَفْوَاهِهِمْ ۚ إِن يَقُولُونَ إِلَّا كَذِبًا', bn: 'এ বিষয়ে তাদের ও তাদের পূর্বপুরুষদের কোনো জ্ঞান নেই। তাদের মুখ থেকে বের হওয়া কথা কতই না গুরুতর! তারা তো মিথ্যা ছাড়া কিছুই বলে না।' },
      { ar: 'فَلَعَلَّكَ بَاخِعٌ نَّفْسَكَ عَلَىٰ آثَارِهِمْ إِن لَّمْ يُؤْمِنُوا بِهَٰذَا الْحَدِيثِ أَسَفًا', bn: 'তারা এই বাণীতে বিশ্বাস না করলে সম্ভবত আপনি তাদের পেছনে দুঃখে নিজেকে ধ্বংস করে ফেলবেন।' },
      { ar: 'إِنَّا جَعَلْنَا مَا عَلَى الْأَرْضِ زِينَةً لَّهَا لِنَبْلُوَهُمْ أَيُّهُمْ أَحْسَنُ عَمَلًا', bn: 'নিশ্চয়ই আমি পৃথিবীর ওপর যা কিছু আছে তা তার শোভা করেছি, যাতে পরীক্ষা করি তাদের মধ্যে কে কর্মে উত্তম।' },
      { ar: 'وَإِنَّا لَجَاعِلُونَ مَا عَلَيْهَا صَعِيدًا جُرُزًا', bn: 'আর নিশ্চয়ই আমি এর ওপর যা আছে সবকিছুকে বৃক্ষহীন শুষ্ক প্রান্তরে পরিণত করব।' },
      { ar: 'أَمْ حَسِبْتَ أَنَّ أَصْحَابَ الْكَهْفِ وَالرَّقِيمِ كَانُوا مِنْ آيَاتِنَا عَجَبًا', bn: 'আপনি কি মনে করেন যে, গুহা ও রকীমের অধিবাসীরা আমার নিদর্শনসমূহের মধ্যে বিস্ময়কর ছিল?' },
      { ar: 'إِذْ أَوَى الْفِتْيَةُ إِلَى الْكَهْفِ فَقَالُوا رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا', bn: 'যখন যুবকেরা গুহায় আশ্রয় নিল, তখন তারা বলল: হে আমাদের রব! আপনার পক্ষ থেকে আমাদের রহমত দিন এবং আমাদের কাজের সঠিক পথ ব্যবস্থা করুন।' },
    ],
  },
  {
    id: 93,
    nameAr: 'سورة الضحى',
    nameBn: 'সূরা আদ-দুহা',
    verses: 11,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'وَالضُّحَىٰ ۝ وَاللَّيْلِ إِذَا سَجَىٰ', bn: 'শপথ পূর্বাহ্ণের এবং শপথ রাতের যখন তা গভীর হয়,' },
      { ar: 'مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ', bn: 'আপনার রব আপনাকে পরিত্যাগ করেননি এবং অসন্তুষ্টও হননি।' },
      { ar: 'وَلَلْآخِرَةُ خَيْرٌ لَّكَ مِنَ الْأُولَىٰ', bn: 'আর আপনার জন্য পরবর্তী সময় (আখিরাত) পূর্ববর্তী সময়ের চেয়ে অবশ্যই উত্তম।' },
      { ar: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ', bn: 'অচিরেই আপনার রব আপনাকে এত দান করবেন যে আপনি সন্তুষ্ট হয়ে যাবেন।' },
      { ar: 'أَلَمْ يَجِدْكَ يَتِيمًا فَآوَىٰ ۝ وَوَجَدَكَ ضَالًّا فَهَدَىٰ ۝ وَوَجَدَكَ عَائِلًا فَأَغْنَىٰ', bn: 'তিনি কি আপনাকে এতীম অবস্থায় পাননি, অতঃপর আশ্রয় দিয়েছেন? পথহারা পাননি, অতঃপর পথ দেখিয়েছেন? নিঃস্ব পাননি, অতঃপর অভাবমুক্ত করেছেন?' },
      { ar: 'فَأَمَّا الْيَتِيمَ فَلَا تَقْهَرْ ۝ وَأَمَّا السَّائِلَ فَلَا تَنْهَرْ ۝ وَأَمَّا بِنِعْمَةِ رَبِّكَ فَحَدِّثْ', bn: 'অতএব এতীমের প্রতি কঠোর হবেন না, সাহায্যপ্রার্থীকে ধমক দেবেন না এবং আপনার রবের নেয়ামতের কথা প্রকাশ করুন।' },
    ],
  },
  {
    id: 94,
    nameAr: 'سورة الشرح',
    nameBn: 'সূরা আল-ইনশিরাহ',
    verses: 8,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ ۝ وَوَضَعْنَا عَنكَ وِزْرَكَ ۝ الَّذِي أَنقَضَ ظَهْرَكَ', bn: 'আমি কি আপনার বক্ষ প্রশস্ত করে দিইনি? এবং আপনার ওপর থেকে আপনার বোঝা নামিয়ে দিইনি, যা আপনার পিঠ ভেঙে দিচ্ছিল?' },
      { ar: 'وَرَفَعْنَا لَكَ ذِكْرَكَ', bn: 'আর আমি আপনার স্মরণকে সমুন্নত করেছি।' },
      { ar: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا', bn: 'নিশ্চয়ই কষ্টের সাথেই স্বস্তি রয়েছে; নিশ্চয়ই কষ্টের সাথেই রয়েছে স্বস্তি।' },
      { ar: 'فَإِذَا فَرَغْتَ فَانصَبْ ۝ وَإِلَىٰ رَبِّكَ فَارْغَب', bn: 'অতএব যখনই অবসর পান, ইবাদতে পরিশ্রম করুন এবং আপনার রবের প্রতিই মনোনিবেশ করুন।' },
    ],
  },
  {
    id: 97,
    nameAr: 'سورة القدر',
    nameBn: 'সূরা আল-কদর',
    verses: 5,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'إِنَّا أَنزَلْنَاهُ فِي لَيْلَةِ الْقَدْرِ', bn: 'নিশ্চয়ই আমি এই কুরআন নাজিল করেছি মহিমান্বিত রজনীতে (লাইলাতুল কদরে)।' },
      { ar: 'وَمَا أَدْرَاكَ مَا لَيْلَةُ الْقَدْرِ', bn: 'আপনি কি জানেন লাইলাতুল কদর কী?' },
      { ar: 'لَيْلَةُ الْقَدْرِ خَيْرٌ مِّنْ أَلْفِ شَهْرٍ', bn: 'লাইলাতুল কদর হাজার মাসের চেয়েও উত্তম।' },
      { ar: 'تَنَزَّلُ الْمَلَائِكَةُ وَالرُّوحُ فِيهَا بِإِذْنِ رَبِّهِم مِّن كُلِّ أَمْرٍ', bn: 'সে রাতে ফেরেশতাগণ ও রূহ (জিবরাঈল) তাদের রবের অনুমতিক্রমে সকল সিদ্ধান্ত নিয়ে অবতরণ করেন।' },
      { ar: 'سَلَامٌ هِيَ حَتَّىٰ مَطْلَعِ الْفَجْرِ', bn: 'শান্তিময় সেই রাত, ফজর উদয় হওয়া পর্যন্ত।' },
    ],
  },
  {
    id: 103,
    nameAr: 'سورة العصر',
    nameBn: 'সূরা আল-আসর',
    verses: 3,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'وَالْعَصْرِ', bn: 'সময়ের শপথ,' },
      { ar: 'إِنَّ الْإِنسَانَ لَفِي خُسْرٍ', bn: 'নিশ্চয়ই মানুষ ক্ষতির মধ্যে রয়েছে।' },
      { ar: 'إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ', bn: 'তবে তারা ব্যতীত, যারা ঈমান এনেছে, সৎকর্ম করেছে এবং পরস্পরকে সত্য ও ধৈর্যের উপদেশ দিয়েছে।' },
    ],
  },
  {
    id: 108,
    nameAr: 'سورة الكوثر',
    nameBn: 'সূরা আল-কাউসার',
    verses: 3,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ', bn: 'নিশ্চয়ই আমি আপনাকে কাউসার দান করেছি।' },
      { ar: 'فَصَلِّ لِرَبِّكَ وَانْحَرْ', bn: 'অতএব আপনার প্রতিপালকের উদ্দেশ্যে সালাত আদায় করুন এবং কুরবানী করুন।' },
      { ar: 'إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ', bn: 'নিশ্চয়ই আপনার প্রতি বিদ্বেষ পোষণকারীই নির্বংশ।' },
    ],
  },
  {
    id: 112,
    nameAr: 'سورة الإخلاص',
    nameBn: 'সূরা আল-ইখলাস',
    verses: 4,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'قُلْ هُوَ اللَّهُ أَحَدٌ', bn: 'বলুন, তিনি আল্লাহ, এক ও অদ্বিতীয়।' },
      { ar: 'اللَّهُ الصَّمَدُ', bn: 'আল্লাহ অমুখাপেক্ষী (সকল কিছু তাঁর ওপর নির্ভরশীল)।' },
      { ar: 'لَمْ يَلِدْ وَلَمْ يُولَدْ', bn: 'তিনি কাউকে জন্ম দেননি এবং তাঁকেও জন্ম দেওয়া হয়নি।' },
      { ar: 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', bn: 'আর তাঁর সমতুল্য কেউ নেই।' },
    ],
  },
  {
    id: 113,
    nameAr: 'سورة الفلق',
    nameBn: 'সূরা আল-ফালাক',
    verses: 5,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', bn: 'বলুন, আমি আশ্রয় চাই ভোরের রবের কাছে,' },
      { ar: 'مِن شَرِّ مَا خَلَقَ', bn: 'তিনি যা সৃষ্টি করেছেন তার অনিষ্ট থেকে,' },
      { ar: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', bn: 'রাতের অন্ধকারের অনিষ্ট থেকে যখন তা গভীর হয়,' },
      { ar: 'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ', bn: 'গ্রন্থিতে ফুঁকদানকারিণীদের অনিষ্ট থেকে,' },
      { ar: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', bn: 'এবং হিংসুকের অনিষ্ট থেকে যখন সে হিংসা করে।' },
    ],
  },
  {
    id: 114,
    nameAr: 'سورة الناس',
    nameBn: 'সূরা আন-নাস',
    verses: 6,
    place: 'মাক্কী',
    ayahs: [
      { ar: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ', bn: 'বলুন, আমি আশ্রয় চাই মানুষের রবের কাছে,' },
      { ar: 'مَلِكِ النَّاسِ', bn: 'মানুষের অধিপতির কাছে,' },
      { ar: 'إِلَٰهِ النَّاسِ', bn: 'মানুষের ইলাহের কাছে,' },
      { ar: 'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ', bn: 'আত্মগোপনকারী কুমন্ত্রণাদাতার অনিষ্ট থেকে,' },
      { ar: 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ', bn: 'যে মানুষের অন্তরে কুমন্ত্রণা দেয়,' },
      { ar: 'مِنَ الْجِنَّةِ وَالنَّاسِ', bn: 'জিন ও মানুষের মধ্য থেকে।' },
    ],
  },
];

const RUQYAH_TRACKS = [
  {
    id: 'ruqyah-fatiha',
    title: '১. সূরা আল-ফাতিহা (শিফা ও রুকইয়াহর মূল)',
    source: 'সূরা ফাতিহা · সহীহ বুখারী: ৫৭৩৬',
    arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ ۝ مَالِكِ يَوْمِ الدِّينِ ۝ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ۝ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ۝ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    bangla: 'সকল প্রশংসা আল্লাহর... আমরা কেবল আপনারই ইবাদত করি এবং আপনারই সাহায্য চাই।',
  },
  {
    id: 'ruqyah-kursi',
    title: '২. আয়াতুল কুরসী (শয়তান ও জাদু থেকে সুরক্ষা)',
    source: 'সূরা বাকারা: ২৫৫ · সহীহ বুখারী: ২৩১১',
    arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
    bangla: 'আল্লাহ চিরঞ্জীব ও সবকিছুর ধারক; তাঁর কুরসী আসমান-জমিন পরিবেষ্টন করে আছে।',
  },
  {
    id: 'ruqyah-muawwidhat',
    title: '৩. তিন কুল (ইখলাস, ফালাক ও নাস — ৩ বার)',
    source: 'সুনানে আবু দাউদ: ৫০৮২',
    arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ قُلْ أَعُوذُ بِرَبِّ النَّاسِ',
    bangla: 'বদনজর, হিংসা, জাদু ও সকল অনিষ্ট থেকে আল্লাহর আশ্রয়।',
  },
  {
    id: 'ruqyah-shifa',
    title: '৪. মাসনুন শিফা ও ব্যথা উপশমের দোয়া',
    source: 'সহীহ বুখারী: ৫৭৪৩, সহীহ মুসলিম: ২১৯১',
    arabic: 'أَذْهِبِ الْبَأْسَ رَبَّ النَّاسِ، اشْفِ وَأَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا',
    bangla: 'হে মানুষের রব! কষ্ট দূর করুন ও এমন আরোগ্য দিন যা কোনো রোগ অবশিষ্ট রাখে না।',
  },
  {
    id: 'ruqyah-bismillah',
    title: '৫. জিবরাঈল (আ.)-এর রুকইয়াহ দোয়া',
    source: 'সহীহ মুসলিম: ২১৮৬',
    arabic: 'بِسْمِ اللَّهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ، اللَّهُ يَشْفِيكَ، بِسْمِ اللَّهِ أَرْقِيكَ',
    bangla: 'আল্লাহর নামে আপনাকে ঝাড়ফুঁক করছি প্রতিটি কষ্টদায়ক বস্তু এবং প্রত্যেক অনিষ্টকারী বা হিংসুকের বদনজর থেকে; আল্লাহ আপনাকে সুস্থ করুন।',
  },
];

const TOTAL_QURAN_PAGES = 604;

interface QuranViewProps {
  darkMode: boolean;
  quranState: QuranState;
  onChangeQuran: (next: QuranState) => void;
  onNotify: (msg: string) => void;
}

export default function QuranView({
  darkMode,
  quranState,
  onChangeQuran,
  onNotify,
}: QuranViewProps) {
  const [subTab, setSubTab] = useState<'quran' | 'ruqyah'>('quran');
  const [fontSize, setFontSize] = useState(26);
  const [surahQuery, setSurahQuery] = useState('');

  // Ruqyah player states
  const [ruqyahIdx, setRuqyahIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoLoop, setAutoLoop] = useState(true);
  const [sleepMins, setSleepMins] = useState<number>(0);
  const [sleepLeftSec, setSleepLeftSec] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedMeta: SurahMeta = useMemo(
    () => ALL_SURAHS.find((s) => s.id === quranState.lastSurahId) || ALL_SURAHS[0],
    [quranState.lastSurahId]
  );
  const selectedSurah = useMemo(
    () => OFFLINE_SURAHS.find((s) => s.id === quranState.lastSurahId) || null,
    [quranState.lastSurahId]
  );
  const filteredSurahs = useMemo(() => {
    const q = surahQuery.trim().toLowerCase();
    if (!q) return ALL_SURAHS;
    return ALL_SURAHS.filter(
      (s) =>
        String(s.id) === q ||
        s.nameBn.toLowerCase().includes(q) ||
        s.nameAr.includes(q)
    );
  }, [surahQuery]);

  const stopRuqyah = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
  };

  useEffect(() => {
    if (!isPlaying || sleepLeftSec <= 0) return;
    const id = window.setInterval(() => {
      setSleepLeftSec((prev) => {
        if (prev <= 1) {
          stopRuqyah();
          setSleepMins(0);
          onNotify('স্লিপ টাইমার শেষ হওয়ায় রুকইয়াহ বন্ধ হয়েছে');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isPlaying, sleepLeftSec, onNotify]);

  useEffect(() => () => stopRuqyah(), []);

  const playRuqyahTrack = (idx: number) => {
    stopRuqyah();
    const track = RUQYAH_TRACKS[idx];
    if (!track) return;
    setRuqyahIdx(idx);
    setIsPlaying(true);

    const handleEnded = () => {
      const nextIdx = idx + 1;
      if (nextIdx < RUQYAH_TRACKS.length) {
        playRuqyahTrack(nextIdx);
      } else if (autoLoop) {
        playRuqyahTrack(0);
      } else {
        setIsPlaying(false);
      }
    };

    const audio = new Audio(`/audio/${track.id}.opus`);
    audioRef.current = audio;
    audio.onended = handleEnded;
    audio.onerror = () => {
      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(track.arabic);
          utter.lang = 'ar-SA';
          utter.rate = 0.9;
          utter.onend = handleEnded;
          window.speechSynthesis.speak(utter);
        } else {
          setIsPlaying(false);
        }
      } catch {
        setIsPlaying(false);
      }
    };
    audio.play().catch(() => audio.onerror?.(new Event('error')));
  };

  const pct = Math.min(100, Math.round((quranState.pagesRead / TOTAL_QURAN_PAGES) * 100));
  const currentJuz = Math.min(30, Math.max(1, Math.ceil((quranState.pagesRead || 1) / 20)));
  const dailyTargetPages = Math.max(1, Math.ceil(TOTAL_QURAN_PAGES / Math.max(1, quranState.targetDays)));

  const cardCls = darkMode ? 'bg-[#121F1B] border-[#243832]' : 'bg-white border-[#DCE3E0]';
  const isBookmarked = quranState.bookmarks.includes(selectedMeta.id);

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Sub-tab Switcher */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSubTab('quran')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            subTab === 'quran' ? 'bg-[#0E5A45] text-white' : 'border border-[#D2DDD8]'
          }`}
        >
          <BookOpen className="w-4 h-4" /> কুরআন রিডার ও খতম প্ল্যানার
        </button>
        <button
          onClick={() => setSubTab('ruqyah')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            subTab === 'ruqyah' ? 'bg-[#0E5A45] text-white' : 'border border-[#D2DDD8]'
          }`}
        >
          <ShieldPlus className="w-4 h-4" /> রুকইয়াহ শারইয়্যাহ ও শিফা
        </button>
      </div>

      {subTab === 'ruqyah' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-5 p-5 rounded-2xl border space-y-3 ${cardCls}`}>
            <h2 className="font-serif-bn font-bold text-lg">রুকইয়াহ ও শিফা প্লেলিস্ট</h2>
            <p className="text-xs opacity-75">কুরআন ও সহীহ হাদীসসম্মত ঝাড়ফুঁক (অটো-লুপ ও স্লিপ টাইমারসহ)</p>
            <div className="space-y-2">
              {RUQYAH_TRACKS.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => playRuqyahTrack(i)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                    ruqyahIdx === i
                      ? 'bg-[#E6F2EE] text-[#0A4736] border-[#0E5A45] font-semibold'
                      : 'border-[#DCE3E0] hover:bg-[#0E5A45]/10'
                  }`}
                >
                  <div>{t.title}</div>
                  <div className="text-[11px] opacity-70 mt-0.5">{t.source}</div>
                </button>
              ))}
            </div>
          </div>

          <div className={`lg:col-span-7 p-6 rounded-2xl border flex flex-col justify-between gap-5 ${cardCls}`}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE3E0]">
                <div>
                  <h3 className="font-serif-bn font-bold text-lg">{RUQYAH_TRACKS[ruqyahIdx].title}</h3>
                  <p className="text-xs opacity-70">{RUQYAH_TRACKS[ruqyahIdx].source}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setAutoLoop(!autoLoop)}
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-1 ${
                      autoLoop ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" /> লুপ {autoLoop ? 'চালু' : 'বন্ধ'}
                  </button>
                  <select
                    value={sleepMins}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      setSleepMins(m);
                      setSleepLeftSec(m * 60);
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-[#D2DDD8] bg-transparent"
                  >
                    <option value={0}>স্লিপ টাইমার: বন্ধ</option>
                    <option value={15}>১৫ মিনিট</option>
                    <option value={30}>৩০ মিনিট</option>
                    <option value={60}>৬০ মিনিট</option>
                  </select>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#0E5A45]/10">
                <p className="font-arabic-amiri text-right text-2xl leading-loose">
                  {RUQYAH_TRACKS[ruqyahIdx].arabic}
                </p>
              </div>
              <p className="text-sm leading-relaxed opacity-90">{RUQYAH_TRACKS[ruqyahIdx].bangla}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DCE3E0]">
              <button
                onClick={() => (isPlaying ? stopRuqyah() : playRuqyahTrack(ruqyahIdx))}
                className="px-5 py-2.5 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold flex items-center gap-2"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'থামুন' : 'রুকইয়াহ শুনুন'}
              </button>
              {sleepLeftSec > 0 && (
                <span className="text-xs font-mono-code flex items-center gap-1 opacity-80">
                  <Timer className="w-3.5 h-3.5" />
                  {Math.floor(sleepLeftSec / 60)}:{String(sleepLeftSec % 60).padStart(2, '0')} বাকি
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Khatam Planner Banner */}
          <div className={`p-6 rounded-2xl border space-y-4 ${cardCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-serif-bn font-bold text-xl flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#0E5A45]" /> কুরআন খতম প্ল্যানার (৬০৪ পৃষ্ঠা)
                </h2>
                <p className="text-xs opacity-75 mt-1">
                  লক্ষ্য: {quranState.targetDays} দিনে ১ খতম (দৈনিক ~{dailyTargetPages} পৃষ্ঠা) · বর্তমান পারা: {currentJuz}/৩০
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={quranState.targetDays}
                  onChange={(e) => onChangeQuran({ ...quranState, targetDays: Number(e.target.value) })}
                  className="px-3 py-1.5 rounded-xl border border-[#D2DDD8] bg-transparent"
                >
                  <option value={30}>৩০ দিনে খতম (দৈনিক ১ পারা)</option>
                  <option value={60}>৬০ দিনে খতম (দৈনিক ১০ পৃষ্ঠা)</option>
                  <option value={90}>৯০ দিনে খতম (দৈনিক ৭ পৃষ্ঠা)</option>
                </select>
                <button
                  onClick={() => onChangeQuran({ ...quranState, pagesRead: 0 })}
                  title="রিসেট"
                  className="p-2 rounded-xl border border-[#D2DDD8]"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="w-full h-3 rounded-full bg-[#DCE3E0] overflow-hidden">
              <div className="h-full bg-[#0E5A45] transition-all" style={{ width: `${pct}%` }} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-mono-code font-bold text-sm text-[#0E5A45]">
                {quranState.pagesRead} / {TOTAL_QURAN_PAGES} পৃষ্ঠা ({pct}%)
              </span>
              <div className="flex flex-wrap gap-2">
                {[1, 5, 20].map((inc) => (
                  <button
                    key={inc}
                    onClick={() => {
                      const next = Math.min(TOTAL_QURAN_PAGES, quranState.pagesRead + inc);
                      onChangeQuran({ ...quranState, pagesRead: next });
                      if (next === TOTAL_QURAN_PAGES) onNotify('মাশাআল্লাহ! কুরআন খতম সম্পন্ন হয়েছে!');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#0E5A45] text-white font-semibold"
                  >
                    +{inc === 20 ? '১ পারা (২০ পৃষ্ঠা)' : `${inc} পৃষ্ঠা`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Offline Reader */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className={`lg:col-span-4 p-4 rounded-2xl border space-y-2.5 max-h-[560px] flex flex-col ${cardCls}`}>
              <div className="space-y-2 pb-2 border-b border-[#DCE3E0]">
                <h3 className="font-serif-bn font-bold text-sm px-1">
                  পূর্ণ ১১৪ সূরা ({filteredSurahs.length}টি)
                </h3>
                <input
                  type="search"
                  value={surahQuery}
                  onChange={(e) => setSurahQuery(e.target.value)}
                  placeholder="সূরার নাম বা নম্বর (যেমন: 36, ইয়াসীন)..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#D2DDD8] bg-transparent"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredSurahs.map((s) => {
                  const hasOfflineText = OFFLINE_SURAHS.some((o) => o.id === s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => onChangeQuran({ ...quranState, lastSurahId: s.id })}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between border ${
                        selectedMeta.id === s.id
                          ? 'bg-[#E6F2EE] text-[#0A4736] border-[#0E5A45] font-semibold'
                          : 'border-transparent hover:bg-[#0E5A45]/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-code opacity-65">{s.id}.</span>
                          <span>{s.nameBn}</span>
                          {hasOfflineText && (
                            <span className="px-1.5 py-0.5 rounded bg-[#0E5A45]/15 text-[#0E5A45] text-[10px]">পাঠ</span>
                          )}
                        </div>
                        <div className="text-[11px] opacity-70">{s.place} · {s.verses} আয়াত</div>
                      </div>
                      <span className="font-arabic-amiri text-base">{s.nameAr}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`lg:col-span-8 p-6 rounded-2xl border space-y-4 ${cardCls}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE3E0]">
                <div>
                  <h3 className="font-serif-bn font-bold text-xl">
                    {selectedMeta.id}. {selectedMeta.nameBn} ({selectedMeta.nameAr})
                  </h3>
                  <p className="text-xs opacity-70">{selectedMeta.place} · {selectedMeta.verses} আয়াত</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={() => setFontSize((f) => Math.max(20, f - 2))} className="w-7 h-7 rounded border border-[#D2DDD8] font-bold">A-</button>
                  <button onClick={() => setFontSize((f) => Math.min(40, f + 2))} className="w-7 h-7 rounded border border-[#D2DDD8] font-bold">A+</button>
                  <button
                    onClick={() => {
                      const next = isBookmarked
                        ? quranState.bookmarks.filter((b) => b !== selectedMeta.id)
                        : [...quranState.bookmarks, selectedMeta.id];
                      onChangeQuran({ ...quranState, bookmarks: next });
                      onNotify(isBookmarked ? 'বুকমার্ক সরানো হয়েছে' : 'বুকমার্ক সেভ হয়েছে');
                    }}
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-1 ${
                      isBookmarked ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" /> {isBookmarked ? 'বুকমার্কড' : 'বুকমার্ক'}
                  </button>
                </div>
              </div>

              {selectedSurah ? (
                <div className="space-y-4">
                  {selectedSurah.ayahs.map((a, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-[#DCE3E0] space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#0E5A45]/15 text-[#0E5A45] text-xs font-mono-code font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <p className="font-arabic-amiri text-right leading-loose flex-1" style={{ fontSize: `${fontSize}px` }}>
                          {a.ar}
                        </p>
                      </div>
                      <p className="text-sm opacity-90 leading-relaxed">{a.bn}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-[#D2DDD8] text-center space-y-3">
                  <div className="font-arabic-amiri text-3xl text-[#0E5A45]">{selectedMeta.nameAr}</div>
                  <p className="text-sm font-semibold">{selectedMeta.nameBn} — {selectedMeta.verses} আয়াত ({selectedMeta.place})</p>
                  <p className="text-xs opacity-75">
                    হালকা অফলাইন প্যাকেজের কারণে এই সূরার সম্পূর্ণ আরবি-বাংলা পাঠ এখনো যুক্ত করা হয়নি। তবে আপনি আপনার মুসহাফ থেকে পড়ে এখান থেকে খতম অগ্রগতি (+১ পৃষ্ঠা) ও বুকমার্ক ট্র্যাক করতে পারবেন।
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    const next = Math.min(TOTAL_QURAN_PAGES, quranState.pagesRead + 1);
                    onChangeQuran({ ...quranState, pagesRead: next });
                    onNotify('১ পৃষ্ঠা পড়া সম্পন্ন হিসেবে যুক্ত হয়েছে');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> পড়া সম্পন্ন (+১ পৃষ্ঠা)
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
