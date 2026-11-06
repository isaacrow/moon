/**
 * MARC 21 Bibliographic fields for the MARC editor: every field's name (English, Arabic), whether it repeats,
 * the indicators a new field starts with, and its subfields with their names. From LC's MARC 21 Format for
 * Bibliographic Data (https://www.loc.gov/marc/bibliographic/), current fields only.
 */

export interface FieldDef {
  tag: string;
  en: string;
  ar: string;
  repeatable: boolean;
  /** Indicators for a new field ('#'-style blank is ' '). */
  ind1: string;
  ind2: string;
  /** Subfield code → name. */
  subfields: Record<string, string>;
}

// ---- Shared subfield sets ----
const LINK = '6:Linkage|8:Field link and sequence number';
const AUTH = '0:Authority record control number or URI|1:Real World Object URI|2:Source of heading or term|3:Materials specified|4:Relationship|5:Institution to which field applies';
const PERSON = 'a:Personal name|b:Numeration|c:Titles and words associated with a name|d:Dates associated with a name|e:Relator term|f:Date of a work|g:Miscellaneous information|j:Attribution qualifier|k:Form subheading|l:Language of a work|n:Number of part/section of a work|p:Name of part/section of a work|q:Fuller form of name|t:Title of a work|u:Affiliation';
const CORP = 'a:Corporate name or jurisdiction name|b:Subordinate unit|c:Location of meeting|d:Date of meeting or treaty signing|e:Relator term|f:Date of a work|g:Miscellaneous information|k:Form subheading|l:Language of a work|n:Number of part/section/meeting|p:Name of part/section of a work|t:Title of a work|u:Affiliation';
const MEETING = 'a:Meeting name or jurisdiction name|c:Location of meeting|d:Date of meeting|e:Subordinate unit|g:Miscellaneous information|j:Relator term|k:Form subheading|l:Language of a work|n:Number of part/section/meeting|p:Name of part/section of a work|q:Name of meeting following jurisdiction|t:Title of a work|u:Affiliation';
const UNIFORM = 'a:Uniform title|d:Date of treaty signing|f:Date of a work|g:Miscellaneous information|h:Medium|k:Form subheading|l:Language of a work|m:Medium of performance for music|n:Number of part/section of a work|o:Arranged statement for music|p:Name of part/section of a work|r:Key for music|s:Version|t:Title of a work';
const SUBDIV = 'v:Form subdivision|x:General subdivision|y:Chronological subdivision|z:Geographic subdivision';
const LINKING = 'a:Main entry heading|b:Edition|c:Qualifying information|d:Place, publisher, and date of publication|g:Related parts|h:Physical description|i:Relationship information|k:Series data for related item|m:Material-specific details|n:Note|o:Other item identifier|r:Report number|s:Uniform title|t:Title|u:Standard Technical Report Number|w:Record control number|x:International Standard Serial Number|y:CODEN designation|z:International Standard Book Number|4:Relationship|7:Control subfield';
const NOTE = 'a:Note';

const parse = (s: string): Record<string, string> =>
  Object.fromEntries(s.split('|').filter(Boolean).map((p) => [p[0], p.slice(2)]));

const F = (tag: string, en: string, ar: string, repeatable: boolean, ind1: string, ind2: string, subfields = '') =>
  ({ tag, en, ar, repeatable, ind1, ind2, subfields: parse(subfields) }) as FieldDef;

const DEFS: FieldDef[] = [
  // ---- Control fields ----
  F('001', 'Control number', 'رقم الضبط', false, '', ''),
  F('003', 'Control number identifier', 'معرف رقم الضبط', false, '', ''),
  F('005', 'Date and time of latest transaction', 'تاريخ ووقت آخر تعديل', false, '', ''),
  F('006', 'Fixed-length data elements — additional material characteristics', 'عناصر ثابتة الطول — خصائص مادية إضافية', true, '', ''),
  F('007', 'Physical description fixed field', 'حقل الوصف المادي الثابت', true, '', ''),
  F('008', 'Fixed-length data elements', 'عناصر البيانات ثابتة الطول', false, '', ''),
  // ---- Numbers and codes ----
  F('010', 'Library of Congress control number', 'رقم ضبط مكتبة الكونغرس', false, ' ', ' ', `a:LC control number|b:NUCMC control number|z:Canceled/invalid LC control number|${LINK}`),
  F('015', 'National bibliography number', 'رقم الببليوغرافيا الوطنية', true, ' ', ' ', `a:National bibliography number|q:Qualifying information|z:Canceled/invalid number|2:Source|${LINK}`),
  F('016', 'National bibliographic agency control number', 'رقم ضبط الوكالة الببليوغرافية الوطنية', true, ' ', ' ', `a:Record control number|z:Canceled/invalid control number|2:Source|${LINK}`),
  F('017', 'Copyright or legal deposit number', 'رقم الإيداع القانوني', true, ' ', ' ', `a:Copyright or legal deposit number|b:Assigning agency|d:Date|i:Display text|z:Canceled/invalid number|2:Source|${LINK}`),
  F('020', 'International Standard Book Number', 'الرقم الدولي المعياري للكتاب (ردمك)', true, ' ', ' ', `a:ISBN|c:Terms of availability|q:Qualifying information|z:Canceled/invalid ISBN|${LINK}`),
  F('022', 'International Standard Serial Number', 'الرقم الدولي المعياري للدوريات (ردمد)', true, ' ', ' ', `a:ISSN|l:ISSN-L|m:Canceled ISSN-L|y:Incorrect ISSN|z:Canceled ISSN|2:Source|${LINK}`),
  F('024', 'Other standard identifier', 'معرف معياري آخر', true, '7', ' ', `a:Standard number or code|c:Terms of availability|d:Additional codes|q:Qualifying information|z:Canceled/invalid number|2:Source of number or code|${LINK}`),
  F('028', 'Publisher or distributor number', 'رقم الناشر أو الموزع', true, '2', '2', `a:Publisher or distributor number|b:Source|q:Qualifying information|${LINK}`),
  F('033', 'Date/time and place of an event', 'تاريخ ومكان حدث', true, ' ', ' ', `a:Formatted date/time|b:Geographic classification area code|c:Geographic classification subarea code|p:Place of event|0:Record control number|2:Source of term|3:Materials specified|${LINK}`),
  F('034', 'Coded cartographic mathematical data', 'البيانات الرياضية الخرائطية المرمزة', true, '1', ' ', `a:Category of scale|b:Constant ratio linear horizontal scale|d:Coordinates — westernmost longitude|e:Coordinates — easternmost longitude|f:Coordinates — northernmost latitude|g:Coordinates — southernmost latitude|${LINK}`),
  F('035', 'System control number', 'رقم ضبط النظام', true, ' ', ' ', `a:System control number|z:Canceled/invalid control number|${LINK}`),
  F('040', 'Cataloging source', 'مصدر الفهرسة', false, ' ', ' ', `a:Original cataloging agency|b:Language of cataloging|c:Transcribing agency|d:Modifying agency|e:Description conventions|${LINK}`),
  F('041', 'Language code', 'رمز اللغة', true, '0', ' ', `a:Language code of text/sound track or separate title|b:Language code of summary or abstract|d:Language code of sung or spoken text|e:Language code of librettos|f:Language code of table of contents|g:Language code of accompanying material|h:Language code of original|j:Language code of subtitles|k:Language code of intermediate translations|m:Language code of original accompanying materials|n:Language code of original libretto|p:Language code of captions|q:Language code of accessible audio|r:Language code of accessible visual language|t:Language code of accompanying transcripts|2:Source of code|${LINK}`),
  F('042', 'Authentication code', 'رمز التوثيق', false, ' ', ' ', 'a:Authentication code'),
  F('043', 'Geographic area code', 'رمز المنطقة الجغرافية', false, ' ', ' ', `a:Geographic area code|b:Local GAC code|c:ISO code|0:Authority record control number or URI|1:Real World Object URI|2:Source of local code|${LINK}`),
  F('044', 'Country of publishing/producing entity code', 'رمز بلد النشر', false, ' ', ' ', `a:MARC country code|b:Local subentity code|c:ISO country code|2:Source of local subentity code|${LINK}`),
  F('045', 'Time period of content', 'الفترة الزمنية للمحتوى', false, ' ', ' ', `a:Time period code|b:Formatted 9999 B.C. through C.E. time period|c:Formatted pre-9999 B.C. time period|${LINK}`),
  F('046', 'Special coded dates', 'تواريخ مرمزة خاصة', true, ' ', ' ', `a:Type of date code|b:Date 1, B.C.E. date|c:Date 1, C.E. date|d:Date 2, B.C.E. date|e:Date 2, C.E. date|j:Date resource modified|k:Beginning or single date created|l:Ending date created|m:Beginning of date valid|n:End of date valid|o:Single or starting date for aggregated content|p:Ending date for aggregated content|x:Nonpublic note|z:Public note|2:Source of date scheme|${LINK}`),
  F('050', 'Library of Congress call number', 'رقم الطلب حسب تصنيف الكونغرس', true, ' ', '4', `a:Classification number|b:Item number|0:Authority record control number or URI|1:Real World Object URI|3:Materials specified|${LINK}`),
  F('052', 'Geographic classification', 'التصنيف الجغرافي', true, ' ', ' ', `a:Geographic classification area code|b:Geographic classification subarea code|d:Populated place name|2:Code source|${LINK}`),
  F('055', 'Classification numbers assigned in Canada', 'أرقام تصنيف كندية', true, ' ', '4', `a:Classification number|b:Item number|2:Source of call/class number|${LINK}`),
  F('060', 'National Library of Medicine call number', 'رقم طلب المكتبة الوطنية للطب', true, ' ', '4', `a:Classification number|b:Item number|${LINK}`),
  F('066', 'Character sets present', 'مجموعات المحارف المستخدمة', false, ' ', ' ', 'a:Primary G0 character set|b:Primary G1 character set|c:Alternate G0 or G1 character set'),
  F('070', 'National Agricultural Library call number', 'رقم طلب المكتبة الزراعية الوطنية', true, '0', ' ', `a:Classification number|b:Item number|${LINK}`),
  F('072', 'Subject category code', 'رمز فئة الموضوع', true, ' ', '7', `a:Subject category code|x:Subject category code subdivision|2:Source|${LINK}`),
  F('080', 'Universal Decimal Classification number', 'رقم التصنيف العشري العالمي', true, ' ', ' ', `a:Universal Decimal Classification number|b:Item number|x:Common auxiliary subdivision|2:Edition identifier|${LINK}`),
  F('082', 'Dewey Decimal Classification number', 'رقم تصنيف ديوي العشري', true, '0', '4', `a:Classification number|b:Item number|m:Standard or optional designation|q:Assigning agency|2:Edition number|${LINK}`),
  F('083', 'Additional Dewey Decimal Classification number', 'رقم ديوي إضافي', true, '0', ' ', `a:Classification number|c:Classification number — ending number of span|m:Standard or optional designation|q:Assigning agency|y:Table sequence number|z:Table identification|2:Edition number|${LINK}`),
  F('084', 'Other classification number', 'رقم تصنيف آخر', true, ' ', ' ', `a:Classification number|b:Item number|q:Assigning agency|2:Number source|${LINK}`),
  F('086', 'Government document classification number', 'رقم تصنيف الوثائق الحكومية', true, ' ', ' ', `a:Classification number|z:Canceled/invalid classification number|2:Number source|${LINK}`),
  F('090', 'Local call number (LC-type)', 'رقم طلب محلي (كونغرس)', true, ' ', ' ', 'a:Classification number|b:Local cutter number'),
  F('092', 'Local call number (Dewey)', 'رقم طلب محلي (ديوي)', true, ' ', ' ', 'a:Classification number|b:Item number|2:Edition number'),
  // ---- Main entries ----
  F('100', 'Main entry — personal name', 'المدخل الرئيسي — اسم شخص', false, '1', ' ', `${PERSON}|${AUTH}|${LINK}`),
  F('110', 'Main entry — corporate name', 'المدخل الرئيسي — اسم هيئة', false, '2', ' ', `${CORP}|${AUTH}|${LINK}`),
  F('111', 'Main entry — meeting name', 'المدخل الرئيسي — اسم مؤتمر', false, '2', ' ', `${MEETING}|${AUTH}|${LINK}`),
  F('130', 'Main entry — uniform title', 'المدخل الرئيسي — العنوان الموحد', false, '0', ' ', `${UNIFORM}|${AUTH}|${LINK}`),
  // ---- Titles ----
  F('210', 'Abbreviated title', 'العنوان المختصر', true, '0', ' ', `a:Abbreviated title|b:Qualifying information|2:Source|${LINK}`),
  F('222', 'Key title', 'العنوان المفتاح', true, ' ', '0', `a:Key title|b:Qualifying information|${LINK}`),
  F('240', 'Uniform title', 'العنوان الموحد', false, '1', '0', `${UNIFORM}|0:Authority record control number or URI|1:Real World Object URI|${LINK}`),
  F('242', 'Translation of title by cataloging agency', 'ترجمة العنوان', true, '0', '0', `a:Title|b:Remainder of title|c:Statement of responsibility|h:Medium|n:Number of part/section of a work|p:Name of part/section of a work|y:Language code of translated title|${LINK}`),
  F('243', 'Collective uniform title', 'العنوان الموحد الجامع', false, '1', '0', `${UNIFORM}|${LINK}`),
  F('245', 'Title statement', 'بيان العنوان', false, '1', '0', `a:Title|b:Remainder of title|c:Statement of responsibility|f:Inclusive dates|g:Bulk dates|h:Medium|k:Form|n:Number of part/section of a work|p:Name of part/section of a work|s:Version|${LINK}`),
  F('246', 'Varying form of title', 'شكل آخر للعنوان', true, '3', ' ', `a:Title proper/short title|b:Remainder of title|f:Date or sequential designation|g:Miscellaneous information|h:Medium|i:Display text|n:Number of part/section of a work|p:Name of part/section of a work|5:Institution to which field applies|${LINK}`),
  F('247', 'Former title', 'العنوان السابق', true, '1', '0', `a:Title|b:Remainder of title|f:Date or sequential designation|g:Miscellaneous information|h:Medium|n:Number of part/section of a work|p:Name of part/section of a work|x:International Standard Serial Number|${LINK}`),
  // ---- Edition, imprint ----
  F('250', 'Edition statement', 'بيان الطبعة', true, ' ', ' ', `a:Edition statement|b:Remainder of edition statement|3:Materials specified|${LINK}`),
  F('251', 'Version information', 'معلومات الإصدار', true, ' ', ' ', `a:Version|0:Authority record control number or URI|2:Source|3:Materials specified|${LINK}`),
  F('254', 'Musical presentation statement', 'بيان العرض الموسيقي', false, ' ', ' ', `a:Musical presentation statement|${LINK}`),
  F('255', 'Cartographic mathematical data', 'البيانات الرياضية الخرائطية', true, ' ', ' ', `a:Statement of scale|b:Statement of projection|c:Statement of coordinates|d:Statement of zone|e:Statement of equinox|f:Outer G-ring coordinate pairs|g:Exclusion G-ring coordinate pairs|${LINK}`),
  F('256', 'Computer file characteristics', 'خصائص الملف الحاسوبي', false, ' ', ' ', `a:Computer file characteristics|${LINK}`),
  F('257', 'Country of producing entity', 'بلد الجهة المنتجة', true, ' ', ' ', `a:Country of producing entity|0:Authority record control number or URI|1:Real World Object URI|2:Source|${LINK}`),
  F('258', 'Philatelic issue data', 'بيانات الإصدار الطوابعي', true, ' ', ' ', `a:Issuing jurisdiction|b:Denomination|${LINK}`),
  F('260', 'Publication, distribution, etc. (imprint)', 'النشر والتوزيع (بيانات النشر القديمة)', true, ' ', ' ', `a:Place of publication, distribution, etc.|b:Name of publisher, distributor, etc.|c:Date of publication, distribution, etc.|e:Place of manufacture|f:Manufacturer|g:Date of manufacture|3:Materials specified|${LINK}`),
  F('263', 'Projected publication date', 'تاريخ النشر المتوقع', false, ' ', ' ', `a:Projected publication date|${LINK}`),
  F('264', 'Production, publication, distribution, manufacture, and copyright notice', 'الإنتاج والنشر والتوزيع والتصنيع وحقوق النشر', true, ' ', '1', `a:Place of production, publication, distribution, manufacture|b:Name of producer, publisher, distributor, manufacturer|c:Date of production, publication, distribution, manufacture, or copyright notice|3:Materials specified|${LINK}`),
  F('270', 'Address', 'العنوان البريدي', true, ' ', ' ', `a:Address|b:City|c:State or province|d:Country|e:Postal code|k:Telephone number|m:Electronic mail address|p:Contact person|${LINK}`),
  // ---- Physical description ----
  F('300', 'Physical description', 'الوصف المادي', true, ' ', ' ', `a:Extent|b:Other physical details|c:Dimensions|e:Accompanying material|f:Type of unit|g:Size of unit|3:Materials specified|${LINK}`),
  F('306', 'Playing time', 'مدة التشغيل', false, ' ', ' ', `a:Playing time|${LINK}`),
  F('310', 'Current publication frequency', 'تواتر النشر الحالي', false, ' ', ' ', `a:Current publication frequency|b:Date of current publication frequency|0:Authority record control number or URI|1:Real World Object URI|${LINK}`),
  F('321', 'Former publication frequency', 'تواتر النشر السابق', true, ' ', ' ', `a:Former publication frequency|b:Dates of former publication frequency|0:Authority record control number or URI|1:Real World Object URI|${LINK}`),
  F('336', 'Content type', 'نوع المحتوى', true, ' ', ' ', `a:Content type term|b:Content type code|${AUTH}|${LINK}`),
  F('337', 'Media type', 'نوع الوسيط', true, ' ', ' ', `a:Media type term|b:Media type code|${AUTH}|${LINK}`),
  F('338', 'Carrier type', 'نوع الحامل', true, ' ', ' ', `a:Carrier type term|b:Carrier type code|${AUTH}|${LINK}`),
  F('340', 'Physical medium', 'الوسيط المادي', true, ' ', ' ', `a:Material base and configuration|b:Dimensions|c:Materials applied to surface|d:Information recording technique|e:Support|f:Production rate/ratio|g:Color content|h:Location within medium|i:Technical specifications of medium|j:Generation|k:Layout|m:Book format|n:Font size|o:Polarity|p:Illustrative content|q:Reduction ratio designator|${AUTH}|${LINK}`),
  F('344', 'Sound characteristics', 'خصائص الصوت', true, ' ', ' ', `a:Type of recording|b:Recording medium|c:Playing speed|d:Groove characteristic|e:Track configuration|f:Tape configuration|g:Configuration of playback channels|h:Special playback characteristics|${AUTH}|${LINK}`),
  F('345', 'Moving image characteristics', 'خصائص الصورة المتحركة', true, ' ', ' ', `a:Presentation format|b:Projection speed|${AUTH}|${LINK}`),
  F('346', 'Video characteristics', 'خصائص الفيديو', true, ' ', ' ', `a:Video format|b:Broadcast standard|${AUTH}|${LINK}`),
  F('347', 'Digital file characteristics', 'خصائص الملف الرقمي', true, ' ', ' ', `a:File type|b:Encoding format|c:File size|d:Resolution|e:Regional encoding|f:Encoded bitrate|${AUTH}|${LINK}`),
  F('348', 'Notated music characteristics', 'خصائص الموسيقى المدونة', true, ' ', ' ', `a:Format of notated music term|b:Format of notated music code|c:Form of musical notation term|d:Form of musical notation code|${AUTH}|${LINK}`),
  F('362', 'Dates of publication and/or sequential designation', 'تواريخ النشر والترقيم المتسلسل', true, '0', ' ', `a:Dates of publication and/or sequential designation|z:Source of information|${LINK}`),
  F('370', 'Associated place', 'المكان المرتبط', true, ' ', ' ', `c:Associated country|f:Other associated place|g:Place of origin of work or expression|i:Relationship information|s:Start period|t:End period|u:Uniform Resource Identifier|v:Source of information|${AUTH}|${LINK}`),
  F('377', 'Associated language', 'اللغة المرتبطة', true, ' ', ' ', `a:Language code|l:Language term|${AUTH}|${LINK}`),
  F('380', 'Form of work', 'شكل العمل', true, ' ', ' ', `a:Form of work|${AUTH}|${LINK}`),
  F('381', 'Other distinguishing characteristics of work or expression', 'خصائص مميزة أخرى للعمل', true, ' ', ' ', `a:Other distinguishing characteristic|u:Uniform Resource Identifier|v:Source of information|${AUTH}|${LINK}`),
  F('382', 'Medium of performance', 'وسيط الأداء', true, '0', ' ', `a:Medium of performance|b:Soloist|d:Doubling instrument|e:Number of ensembles of the same type|n:Number of performers of the same medium|p:Alternative medium of performance|r:Total number of individuals performing alongside ensembles|s:Total number of performers|t:Total number of ensembles|v:Note|${AUTH}|${LINK}`),
  F('383', 'Numeric designation of musical work', 'الترقيم العددي للعمل الموسيقي', true, ' ', ' ', `a:Serial number|b:Opus number|c:Thematic index number|d:Thematic index code|e:Publisher associated with opus number|${AUTH}|${LINK}`),
  F('384', 'Key', 'المقام الموسيقي', true, ' ', ' ', `a:Key|${LINK}`),
  F('385', 'Audience characteristics', 'خصائص الجمهور', true, ' ', ' ', `a:Audience term|b:Audience code|m:Demographic group term|n:Demographic group code|${AUTH}|${LINK}`),
  F('386', 'Creator/contributor characteristics', 'خصائص المؤلف أو المساهم', true, ' ', ' ', `a:Creator/contributor term|b:Creator/contributor code|i:Relationship information|m:Demographic group term|n:Demographic group code|${AUTH}|${LINK}`),
  F('388', 'Time period of creation', 'فترة الإنشاء', true, '1', ' ', `a:Time period of creation term|${AUTH}|${LINK}`),
  // ---- Series ----
  F('490', 'Series statement', 'بيان السلسلة', true, '0', ' ', `a:Series statement|l:Library of Congress call number|v:Volume/sequential designation|x:International Standard Serial Number|3:Materials specified|${LINK}`),
  // ---- Notes ----
  F('500', 'General note', 'ملاحظة عامة', true, ' ', ' ', `a:General note|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('501', '"With" note', 'ملاحظة «مع»', true, ' ', ' ', `a:With note|5:Institution to which field applies|${LINK}`),
  F('502', 'Dissertation note', 'ملاحظة الأطروحة', true, ' ', ' ', `a:Dissertation note|b:Degree type|c:Name of granting institution|d:Year degree granted|g:Miscellaneous information|o:Dissertation identifier|${LINK}`),
  F('504', 'Bibliography, etc. note', 'ملاحظة الببليوغرافيا والمراجع', true, ' ', ' ', `a:Bibliography, etc. note|b:Number of references|${LINK}`),
  F('505', 'Formatted contents note', 'ملاحظة المحتويات', true, '0', ' ', `a:Formatted contents note|g:Miscellaneous information|r:Statement of responsibility|t:Title|u:Uniform Resource Identifier|${LINK}`),
  F('506', 'Restrictions on access note', 'ملاحظة قيود الإتاحة', true, ' ', ' ', `a:Terms governing access|b:Jurisdiction|c:Physical access provisions|d:Authorized users|e:Authorization|f:Standardized terminology for access restriction|g:Availability date|q:Supplying agency|u:Uniform Resource Identifier|2:Source of term|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('507', 'Scale note for visual materials', 'ملاحظة المقياس', false, ' ', ' ', `a:Representative fraction of scale note|b:Remainder of scale note|${LINK}`),
  F('508', 'Creation/production credits note', 'ملاحظة جهات الإنتاج', true, ' ', ' ', `a:Creation/production credits note|${LINK}`),
  F('510', 'Citation/references note', 'ملاحظة الاستشهادات', true, '4', ' ', `a:Name of source|b:Coverage of source|c:Location within source|u:Uniform Resource Identifier|x:International Standard Serial Number|3:Materials specified|${LINK}`),
  F('511', 'Participant or performer note', 'ملاحظة المشاركين والمؤدين', true, '0', ' ', `a:Participant or performer note|${LINK}`),
  F('513', 'Type of report and period covered note', 'ملاحظة نوع التقرير والفترة', true, ' ', ' ', `a:Type of report|b:Period covered|${LINK}`),
  F('515', 'Numbering peculiarities note', 'ملاحظة خصوصيات الترقيم', true, ' ', ' ', `a:Numbering peculiarities note|${LINK}`),
  F('516', 'Type of computer file or data note', 'ملاحظة نوع الملف الحاسوبي', true, ' ', ' ', `a:Type of computer file or data note|${LINK}`),
  F('518', 'Date/time and place of an event note', 'ملاحظة تاريخ ومكان الحدث', true, ' ', ' ', `a:Date/time and place of an event note|d:Date of event|o:Other event information|p:Place of event|0:Record control number|1:Real World Object URI|2:Source of term|3:Materials specified|${LINK}`),
  F('520', 'Summary, etc.', 'الملخص', true, ' ', ' ', `a:Summary, etc.|b:Expansion of summary note|c:Assigning source|u:Uniform Resource Identifier|2:Source|3:Materials specified|${LINK}`),
  F('521', 'Target audience note', 'ملاحظة الجمهور المستهدف', true, ' ', ' ', `a:Target audience note|b:Source|3:Materials specified|${LINK}`),
  F('522', 'Geographic coverage note', 'ملاحظة التغطية الجغرافية', true, ' ', ' ', `a:Geographic coverage note|${LINK}`),
  F('524', 'Preferred citation of described materials note', 'ملاحظة طريقة الاستشهاد المفضلة', true, ' ', ' ', `a:Preferred citation of described materials note|2:Source of schema used|3:Materials specified|${LINK}`),
  F('525', 'Supplement note', 'ملاحظة الملحق', true, ' ', ' ', `a:Supplement note|${LINK}`),
  F('526', 'Study program information note', 'ملاحظة البرنامج الدراسي', true, '0', ' ', `a:Program name|b:Interest level|c:Reading level|d:Title point value|i:Display text|x:Nonpublic note|z:Public note|5:Institution to which field applies|${LINK}`),
  F('530', 'Additional physical form available note', 'ملاحظة الأشكال المادية الأخرى', true, ' ', ' ', `a:Additional physical form available note|b:Availability source|c:Availability conditions|d:Order number|u:Uniform Resource Identifier|3:Materials specified|${LINK}`),
  F('533', 'Reproduction note', 'ملاحظة الاستنساخ', true, ' ', ' ', `a:Type of reproduction|b:Place of reproduction|c:Agency responsible for reproduction|d:Date of reproduction|e:Physical description of reproduction|f:Series statement of reproduction|m:Dates and/or sequential designation of issues reproduced|n:Note about reproduction|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('534', 'Original version note', 'ملاحظة النسخة الأصلية', true, ' ', ' ', `p:Introductory phrase|a:Main entry of original|b:Edition statement of original|c:Publication, distribution, etc. of original|e:Physical description, etc. of original|f:Series statement of original|k:Key title of original|l:Location of original|m:Material specific details|n:Note about original|o:Other resource identifier|t:Title statement of original|x:International Standard Serial Number|z:International Standard Book Number|3:Materials specified|${LINK}`),
  F('535', 'Location of originals/duplicates note', 'ملاحظة مكان الأصول أو النسخ', true, '1', ' ', `a:Custodian|b:Postal address|c:Country|d:Telecommunications address|g:Repository location code|3:Materials specified|${LINK}`),
  F('536', 'Funding information note', 'ملاحظة التمويل', true, ' ', ' ', `a:Text of note|b:Contract number|c:Grant number|d:Undifferentiated number|e:Program element number|f:Project number|g:Task number|h:Work unit number|${LINK}`),
  F('538', 'System details note', 'ملاحظة تفاصيل النظام', true, ' ', ' ', `a:System details note|i:Display text|u:Uniform Resource Identifier|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('540', 'Terms governing use and reproduction note', 'ملاحظة شروط الاستخدام والاستنساخ', true, ' ', ' ', `a:Terms governing use and reproduction|b:Jurisdiction|c:Authorization|d:Authorized users|f:Use and reproduction rights|g:Availability date|q:Supplying agency|u:Uniform Resource Identifier|2:Source of term|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('541', 'Immediate source of acquisition note', 'ملاحظة مصدر الاقتناء المباشر', true, ' ', ' ', `a:Source of acquisition|b:Address|c:Method of acquisition|d:Date of acquisition|e:Accession number|f:Owner|h:Purchase price|n:Extent|o:Type of unit|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('542', 'Information relating to copyright status', 'معلومات حالة حقوق النشر', true, ' ', ' ', `a:Personal creator|b:Personal creator death date|c:Corporate creator|d:Copyright holder|f:Copyright statement|g:Copyright date|i:Publication date|j:Creation date|k:Publisher|l:Copyright status|n:Note|p:Country of publication or creation|q:Supplying agency|r:Jurisdiction of copyright assessment|s:Source of information|u:Uniform Resource Identifier|3:Materials specified|${LINK}`),
  F('544', 'Location of other archival materials note', 'ملاحظة مكان المواد الأرشيفية الأخرى', true, ' ', ' ', `a:Custodian|b:Address|c:Country|d:Title|e:Provenance|n:Note|3:Materials specified|${LINK}`),
  F('545', 'Biographical or historical data', 'بيانات سيرية أو تاريخية', true, '0', ' ', `a:Biographical or historical data|b:Expansion|u:Uniform Resource Identifier|${LINK}`),
  F('546', 'Language note', 'ملاحظة اللغة', true, ' ', ' ', `a:Language note|b:Information code or alphabet|3:Materials specified|${LINK}`),
  F('547', 'Former title complexity note', 'ملاحظة تعقيد العنوان السابق', true, ' ', ' ', `a:Former title complexity note|${LINK}`),
  F('550', 'Issuing body note', 'ملاحظة الجهة المُصدرة', true, ' ', ' ', `a:Issuing body note|${LINK}`),
  F('552', 'Entity and attribute information note', 'ملاحظة الكيانات والسمات', true, ' ', ' ', `a:Entity type label|b:Entity type definition and source|c:Attribute label|d:Attribute definition and source|o:Overview|${LINK}`),
  F('555', 'Cumulative index/finding aids note', 'ملاحظة الكشافات التراكمية وأدوات البحث', true, ' ', ' ', `a:Cumulative index/finding aids note|b:Availability source|c:Degree of control|d:Bibliographic reference|u:Uniform Resource Identifier|3:Materials specified|${LINK}`),
  F('556', 'Information about documentation note', 'ملاحظة التوثيق', true, ' ', ' ', `a:Information about documentation note|z:International Standard Book Number|${LINK}`),
  F('561', 'Ownership and custodial history', 'تاريخ الملكية والحيازة', true, ' ', ' ', `a:History|u:Uniform Resource Identifier|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('562', 'Copy and version identification note', 'ملاحظة تمييز النسخة', true, ' ', ' ', `a:Identifying markings|b:Copy identification|c:Version identification|d:Presentation format|e:Number of copies|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('563', 'Binding information', 'معلومات التجليد', true, ' ', ' ', `a:Binding note|u:Uniform Resource Identifier|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('565', 'Case file characteristics note', 'ملاحظة خصائص ملفات القضايا', true, ' ', ' ', `a:Number of cases/variables|b:Name of variable|c:Unit of analysis|d:Universe of data|e:Filing scheme or code|3:Materials specified|${LINK}`),
  F('567', 'Methodology note', 'ملاحظة المنهجية', true, ' ', ' ', `a:Methodology note|b:Controlled term|0:Authority record control number or URI|1:Real World Object URI|2:Source of term|${LINK}`),
  F('580', 'Linking entry complexity note', 'ملاحظة تعقيد مداخل الربط', true, ' ', ' ', `a:Linking entry complexity note|${LINK}`),
  F('581', 'Publications about described materials note', 'ملاحظة المنشورات عن المادة', true, ' ', ' ', `a:Publications about described materials note|z:International Standard Book Number|3:Materials specified|${LINK}`),
  F('583', 'Action note', 'ملاحظة الإجراء', true, ' ', ' ', `a:Action|b:Action identification|c:Time/date of action|d:Action interval|e:Contingency for action|f:Authorization|h:Jurisdiction|i:Method of action|j:Site of action|k:Action agent|l:Status|n:Extent|o:Type of unit|u:Uniform Resource Identifier|x:Nonpublic note|z:Public note|2:Source of term|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('584', 'Accumulation and frequency of use note', 'ملاحظة التراكم وتكرار الاستخدام', true, ' ', ' ', `a:Accumulation|b:Frequency of use|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('585', 'Exhibitions note', 'ملاحظة المعارض', true, ' ', ' ', `a:Exhibitions note|3:Materials specified|5:Institution to which field applies|${LINK}`),
  F('586', 'Awards note', 'ملاحظة الجوائز', true, ' ', ' ', `a:Awards note|3:Materials specified|${LINK}`),
  F('588', 'Source of description note', 'ملاحظة مصدر الوصف', true, ' ', ' ', `a:Source of description note|5:Institution to which field applies|${LINK}`),
  F('590', 'Local note', 'ملاحظة محلية', true, ' ', ' ', NOTE),
  // ---- Subject access ----
  F('600', 'Subject added entry — personal name', 'مدخل موضوعي — اسم شخص', true, '1', '0', `${PERSON}|${SUBDIV}|${AUTH}|${LINK}`),
  F('610', 'Subject added entry — corporate name', 'مدخل موضوعي — اسم هيئة', true, '2', '0', `${CORP}|${SUBDIV}|${AUTH}|${LINK}`),
  F('611', 'Subject added entry — meeting name', 'مدخل موضوعي — اسم مؤتمر', true, '2', '0', `${MEETING}|${SUBDIV}|${AUTH}|${LINK}`),
  F('630', 'Subject added entry — uniform title', 'مدخل موضوعي — عنوان موحد', true, '0', '0', `${UNIFORM}|e:Relator term|${SUBDIV}|${AUTH}|${LINK}`),
  F('647', 'Subject added entry — named event', 'مدخل موضوعي — حدث مسمى', true, ' ', '7', `a:Named event|c:Location of named event|d:Date of named event|g:Miscellaneous information|${SUBDIV}|${AUTH}|${LINK}`),
  F('648', 'Subject added entry — chronological term', 'مدخل موضوعي — مصطلح زمني', true, ' ', '7', `a:Chronological term|e:Relator term|${SUBDIV}|${AUTH}|${LINK}`),
  F('650', 'Subject added entry — topical term', 'مدخل موضوعي — مصطلح موضوعي', true, ' ', '0', `a:Topical term or geographic name entry element|b:Topical term following geographic name entry element|c:Location of event|d:Active dates|e:Relator term|g:Miscellaneous information|${SUBDIV}|${AUTH}|${LINK}`),
  F('651', 'Subject added entry — geographic name', 'مدخل موضوعي — اسم جغرافي', true, ' ', '0', `a:Geographic name|e:Relator term|g:Miscellaneous information|${SUBDIV}|${AUTH}|${LINK}`),
  F('653', 'Index term — uncontrolled', 'مصطلح كشفي — غير مقنن', true, ' ', ' ', `a:Uncontrolled term|5:Institution to which field applies|${LINK}`),
  F('654', 'Subject added entry — faceted topical terms', 'مدخل موضوعي — مصطلحات مُوجَّهة', true, ' ', ' ', `a:Focus term|b:Non-focus term|c:Facet/hierarchy designation|e:Relator term|v:Form subdivision|y:Chronological subdivision|z:Geographic subdivision|${AUTH}|${LINK}`),
  F('655', 'Index term — genre/form', 'مصطلح كشفي — النوع/الشكل', true, ' ', '7', `a:Genre/form data or focus term|b:Non-focus term|c:Facet/hierarchy designation|${SUBDIV}|${AUTH}|${LINK}`),
  F('656', 'Index term — occupation', 'مصطلح كشفي — مهنة', true, ' ', '7', `a:Occupation|k:Form|${SUBDIV}|${AUTH}|${LINK}`),
  F('657', 'Index term — function', 'مصطلح كشفي — وظيفة', true, ' ', '7', `a:Function|${SUBDIV}|${AUTH}|${LINK}`),
  F('658', 'Index term — curriculum objective', 'مصطلح كشفي — هدف منهجي', true, ' ', ' ', `a:Main curriculum objective|b:Subordinate curriculum objective|c:Curriculum code|d:Correlation factor|2:Source of term or code|${LINK}`),
  F('662', 'Subject added entry — hierarchical place name', 'مدخل موضوعي — اسم مكان هرمي', true, ' ', ' ', `a:Country or larger entity|b:First-order political jurisdiction|c:Intermediate political jurisdiction|d:City|e:Relator term|f:City subsection|g:Other nonjurisdictional geographic region and feature|h:Extraterrestrial area|${AUTH}|${LINK}`),
  F('688', 'Subject added entry — type of entity unspecified', 'مدخل موضوعي — نوع غير محدد', true, ' ', ' ', `a:Name or subject|e:Relator term|g:Miscellaneous information|${SUBDIV}|${AUTH}|${LINK}`),
  // ---- Added entries ----
  F('700', 'Added entry — personal name', 'مدخل إضافي — اسم شخص', true, '1', ' ', `i:Relationship information|${PERSON}|m:Medium of performance for music|o:Arranged statement for music|r:Key for music|s:Version|x:International Standard Serial Number|${AUTH}|${LINK}`),
  F('710', 'Added entry — corporate name', 'مدخل إضافي — اسم هيئة', true, '2', ' ', `i:Relationship information|${CORP}|x:International Standard Serial Number|${AUTH}|${LINK}`),
  F('711', 'Added entry — meeting name', 'مدخل إضافي — اسم مؤتمر', true, '2', ' ', `i:Relationship information|${MEETING}|x:International Standard Serial Number|${AUTH}|${LINK}`),
  F('720', 'Added entry — uncontrolled name', 'مدخل إضافي — اسم غير مقنن', true, ' ', ' ', `a:Name|e:Relator term|4:Relationship|${LINK}`),
  F('730', 'Added entry — uniform title', 'مدخل إضافي — عنوان موحد', true, '0', ' ', `i:Relationship information|${UNIFORM}|x:International Standard Serial Number|${AUTH}|${LINK}`),
  F('740', 'Added entry — uncontrolled related/analytical title', 'مدخل إضافي — عنوان مرتبط غير مقنن', true, '0', ' ', `a:Uncontrolled related/analytical title|h:Medium|n:Number of part/section of a work|p:Name of part/section of a work|5:Institution to which field applies|${LINK}`),
  F('751', 'Added entry — geographic name', 'مدخل إضافي — اسم جغرافي', true, ' ', ' ', `a:Geographic name|e:Relator term|g:Miscellaneous information|${AUTH}|${LINK}`),
  F('752', 'Added entry — hierarchical place name', 'مدخل إضافي — اسم مكان هرمي', true, ' ', ' ', `a:Country or larger entity|b:First-order political jurisdiction|c:Intermediate political jurisdiction|d:City|e:Relator term|f:City subsection|g:Other nonjurisdictional geographic region and feature|h:Extraterrestrial area|${AUTH}|${LINK}`),
  F('753', 'System details access to computer files', 'تفاصيل النظام للملفات الحاسوبية', true, ' ', ' ', `a:Make and model of machine|b:Programming language|c:Operating system|${AUTH}|${LINK}`),
  F('754', 'Added entry — taxonomic identification', 'مدخل إضافي — التعريف التصنيفي', true, ' ', ' ', `a:Taxonomic name|c:Taxonomic category|d:Common or alternative name|x:Nonpublic note|z:Public note|${AUTH}|${LINK}`),
  F('758', 'Resource identifier', 'معرف المصدر', true, ' ', ' ', `a:Label|i:Relationship information|${AUTH}|${LINK}`),
  // ---- Linking entries ----
  F('760', 'Main series entry', 'مدخل السلسلة الرئيسية', true, '0', ' ', `${LINKING}|${LINK}`),
  F('762', 'Subseries entry', 'مدخل السلسلة الفرعية', true, '0', ' ', `${LINKING}|${LINK}`),
  F('765', 'Original language entry', 'مدخل لغة الأصل', true, '0', ' ', `${LINKING}|${LINK}`),
  F('767', 'Translation entry', 'مدخل الترجمة', true, '0', ' ', `${LINKING}|${LINK}`),
  F('770', 'Supplement/special issue entry', 'مدخل الملحق أو العدد الخاص', true, '0', ' ', `${LINKING}|${LINK}`),
  F('772', 'Supplement parent entry', 'مدخل الأصل للملحق', true, '0', ' ', `${LINKING}|${LINK}`),
  F('773', 'Host item entry', 'مدخل المادة المضيفة', true, '0', ' ', `${LINKING}|p:Abbreviated title|q:Enumeration and first page|${LINK}`),
  F('774', 'Constituent unit entry', 'مدخل الوحدة المكونة', true, '0', ' ', `${LINKING}|${LINK}`),
  F('775', 'Other edition entry', 'مدخل طبعة أخرى', true, '0', ' ', `${LINKING}|e:Language code|f:Country code|${LINK}`),
  F('776', 'Additional physical form entry', 'مدخل شكل مادي آخر', true, '0', ' ', `${LINKING}|${LINK}`),
  F('777', 'Issued with entry', 'مدخل «صدر مع»', true, '0', ' ', `${LINKING}|${LINK}`),
  F('780', 'Preceding entry', 'المدخل السابق', true, '0', '0', `${LINKING}|${LINK}`),
  F('785', 'Succeeding entry', 'المدخل اللاحق', true, '0', '0', `${LINKING}|${LINK}`),
  F('786', 'Data source entry', 'مدخل مصدر البيانات', true, '0', ' ', `${LINKING}|j:Period of content|p:Abbreviated title|v:Source contribution|${LINK}`),
  F('787', 'Other relationship entry', 'مدخل علاقة أخرى', true, '0', ' ', `${LINKING}|${LINK}`),
  // ---- Series added entries ----
  F('800', 'Series added entry — personal name', 'مدخل إضافي للسلسلة — اسم شخص', true, '1', ' ', `${PERSON}|v:Volume/sequential designation|w:Bibliographic record control number|x:International Standard Serial Number|${AUTH}|${LINK}`),
  F('810', 'Series added entry — corporate name', 'مدخل إضافي للسلسلة — اسم هيئة', true, '2', ' ', `${CORP}|v:Volume/sequential designation|w:Bibliographic record control number|x:International Standard Serial Number|${AUTH}|${LINK}`),
  F('811', 'Series added entry — meeting name', 'مدخل إضافي للسلسلة — اسم مؤتمر', true, '2', ' ', `${MEETING}|v:Volume/sequential designation|w:Bibliographic record control number|x:International Standard Serial Number|${AUTH}|${LINK}`),
  F('830', 'Series added entry — uniform title', 'مدخل إضافي للسلسلة — عنوان موحد', true, ' ', '0', `${UNIFORM}|v:Volume/sequential designation|w:Bibliographic record control number|x:International Standard Serial Number|${AUTH}|${LINK}`),
  // ---- Holdings, location, alternate graphics ----
  F('850', 'Holding institution', 'المؤسسة المالكة', true, ' ', ' ', `a:Holding institution|${LINK}`),
  F('852', 'Location', 'الموقع', true, ' ', ' ', `a:Location|b:Sublocation or collection|c:Shelving location|e:Address|h:Classification part|i:Item part|j:Shelving control number|k:Call number prefix|m:Call number suffix|p:Piece designation|t:Copy number|x:Nonpublic note|z:Public note|3:Materials specified|${LINK}`),
  F('856', 'Electronic location and access', 'الموقع الإلكتروني والإتاحة', true, '4', '0', `a:Host name|c:Compression information|d:Path|f:Electronic name|h:Processor of request|l:Logon|m:Contact for access assistance|n:Name of location of host|o:Operating system|p:Port|q:Electronic format type|r:Settings|s:File size|t:Terminal emulation|u:Uniform Resource Identifier|v:Hours access method available|w:Record control number|x:Nonpublic note|y:Link text|z:Public note|2:Access method|3:Materials specified|7:Access status|${LINK}`),
  F('880', 'Alternate graphic representation', 'التمثيل بخط آخر', true, ' ', ' ', `${LINK}|a:Same as associated field`),
  F('881', 'Manifestation statements', 'بيانات التجسيد', true, ' ', ' ', `a:Manifestation statement, high-level/general|b:Manifestation identifier statement|c:Manifestation title and responsibility statement|d:Manifestation edition statement|e:Manifestation details of cartographic and other mathematical data|f:Manifestation sequential designation statement|g:Manifestation production statement|h:Manifestation publication statement|i:Manifestation distribution statement|j:Manifestation manufacture statement|k:Manifestation copyright statement|l:Manifestation frequency statement|m:Manifestation series statement|n:Manifestation dissertation statement|${LINK}`),
  F('883', 'Metadata provenance', 'مصدر البيانات الوصفية', true, ' ', ' ', `a:Creation process|c:Confidence value|d:Creation date|q:Assigning or generating agency|w:Bibliographic record control number|x:Validity end date|u:Uniform Resource Identifier|0:Authority record control number or URI|1:Real World Object URI|${LINK}`),
  F('884', 'Description conversion information', 'معلومات تحويل الوصف', true, ' ', ' ', `a:Conversion process|g:Conversion date|k:Identifier of source metadata|q:Conversion agency|u:Uniform Resource Identifier|${LINK}`),
  F('885', 'Matching information', 'معلومات المطابقة', true, ' ', ' ', `a:Matching information|b:Status of matching and its checking|c:Confidence value|d:Generation date|w:Record control number|x:Nonpublic note|z:Public note|0:Authority record control number or URI|1:Real World Object URI|2:Source|5:Institution to which field applies`),
  F('886', 'Foreign MARC information field', 'حقل معلومات مارك الأجنبي', true, '2', ' ', 'a:Tag of the foreign MARC field|b:Content of the foreign MARC field|2:Source of data'),
  F('887', 'Non-MARC information field', 'حقل معلومات غير مارك', true, ' ', ' ', 'a:Content of non-MARC field|2:Source of data'),
];

export const MARC_FIELDS: Record<string, FieldDef> = Object.fromEntries(DEFS.map((d) => [d.tag, d]));
export const ALL_FIELD_TAGS = DEFS.map((d) => d.tag);

/** The field's definition; a local 9XX field (or any field not listed) gets a generic one. */
export function fieldDef(tag: string): FieldDef | undefined {
  return MARC_FIELDS[tag] || (/^9\d\d$/.test(tag) ? F(tag, 'Local field', 'حقل محلي', true, ' ', ' ', 'a:Local data') : undefined);
}

/** The name of a subfield of a field ("$a Title"), or '' when the format does not define it. */
export function subfieldName(tag: string, code: string): string {
  return fieldDef(tag)?.subfields[code] || (code === '6' ? 'Linkage' : code === '8' ? 'Field link and sequence number' : '');
}

/** Fields whose tag or name matches what the cataloguer typed, best first. */
export function searchFields(query: string, limit = 12): FieldDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (d: FieldDef) => {
    if (d.tag === q) return 0;
    if (d.tag.startsWith(q)) return 1;
    const names = `${d.en} ${d.ar}`.toLowerCase();
    if (names.startsWith(q)) return 2;
    if (names.includes(q)) return 3;
    return 9;
  };
  return DEFS.map((d) => [d, score(d)] as const).filter(([, s]) => s < 9).sort((a, b) => a[1] - b[1] || a[0].tag.localeCompare(b[0].tag)).slice(0, limit).map(([d]) => d);
}
