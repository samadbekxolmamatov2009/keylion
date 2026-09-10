  const wordBanks = {
    en: ("the be to of and a in that have it for not on with he as you do at this but his by from "+
    "they we say her she or an will my one all would there their what so up out if about who get which go me "+
    "when make can like time no just him know take people into year your good some could them see other than "+
    "then now look only come its over think also back after use two how our work first well way even new want "+
    "because any these give day most us function const let var loop array object return class import export "+
    "again against always animal answer ask baby become before begin believe better between big black blue body "+
    "book born bring brother building call car care carry certain change child city class clear close cold color "+
    "come common company continue control cost country course cut dark daughter death develop die different "+
    "difficulty door draw during early earth east easy eat effect end enough even evening every example eye face "+
    "fact fall family far father fear feel few field fight figure fill final find fine finger finish fire five "+
    "floor fly food foot force form four free friend full game garden girl government great green ground grow "+
    "hand happen hard head health hear heart heavy help high hold hope hospital hour house however human idea "+
    "important increase indeed information inside interest issue keep kind kitchen large last late lead learn "+
    "leave left level life light line list little live local long love machine main man matter maybe mean "+
    "measure meet member mention mind minute mission moment money month morning mother mouth move music name "+
    "nature near need never news next night north nothing notice number often once open order paper parent part "+
    "party pass past pattern pay peace people perhaps person picture piece place plan plant play point poor "+
    "position possible power present pretty problem process produce program project public purpose quality "+
    "question quickly quiet rate rather reach read reason receive record red remain remember report rest result "+
    "return right rise room run school season second section seem sense series serve set several shall short "+
    "show side simple since sing sister site situation size skill small society soldier something sound source "+
    "south space speak special stand start state stay step still stop story street strong student study system "+
    "table talk teach team term thank thing third though thousand today together tomorrow tonight top toward "+
    "town travel tree true try turn under understand until upon voice wait walk wall watch water weight west "+
    "while white wide wife win wind woman word world write wrong yard young").split(' '),
    ru: ("и в не на я быть тот он с а как это она к но они мы что за из у который свой весь год время человек "+
    "дело жизнь рука день глаз вопрос дом слово случай работа лицо друг сторона страна мир ребенок город вода "+
    "отец мать книга стол окно дверь стена дорога машина поезд самолет компьютер телефон школа университет "+
    "студент учитель врач магазин деньги хлеб молоко чай солнце луна звезда небо земля лес гора река море "+
    "зима весна лето осень утро вечер ночь сегодня завтра вчера неделя месяц быстро медленно большой маленький "+
    "говорить сказать думать знать понимать видеть слышать чувствовать любить хотеть мочь должен нужно можно "+
    "нельзя делать сделать идти пойти ходить ехать поехать бежать читать писать слушать смотреть играть работать "+
    "учиться отдыхать спать вставать ложиться начинать кончать продолжать помогать давать брать покупать "+
    "продавать платить стоить искать находить терять забывать вспоминать решать выбирать менять оставаться "+
    "становиться казаться нравиться радоваться грустить бояться удивляться улыбаться плакать смеяться петь "+
    "танцевать рисовать строить ломать чинить открывать закрывать включать выключать поднимать опускать бросать "+
    "ловить держать нести везти водить летать плавать входить выходить приходить уходить возвращаться собираться "+
    "готовиться одеваться раздеваться мыться причёсываться завтракать обедать ужинать пить есть готовить убирать "+
    "стирать гладить деньги банк магазин рынок цена скидка товар покупатель продавец касса чек счёт зарплата "+
    "налог кредит вклад машина автобус поезд метро самолёт корабль велосипед дорога улица площадь мост здание "+
    "квартира комната кухня ванная туалет спальня гостиная балкон лестница крыша забор сад двор погода дождь "+
    "снег ветер туман облако гроза радуга мороз жара тепло холодно светло темно рано поздно быстро медленно "+
    "громко тихо далеко близко высоко низко много мало больше меньше лучше хуже новый старый молодой пожилой "+
    "красивый некрасивый умный глупый добрый злой сильный слабый богатый бедный чистый грязный полный пустой "+
    "тяжёлый лёгкий острый тупой сладкий горький солёный кислый вкусный невкусный").split(' '),
    uz: ("va bu u men sen biz siz ular bor yoq keldi ketdi kitob uy ish kun tun vaqt hayot odam bola ota ona "+
    "dost shahar qishloq maktab talaba oqituvchi kompyuter internet telefon mashina yol suv non choy osh "+
    "bozor dokon pul dars savol javob yaxshi yomon katta kichik issiq sovuq tez sekin baland past keng tor "+
    "oq qora qizil kok sariq yashil bugun ertaga kecha hafta oy yil soat daqiqa soniya bahor yoz kuz qish "+
    "togʻ dengiz daryo ormon gul daraxt hayvon qush baliq it mushuk ot sigir sut gosht meva sabzavot olma uzum "+
    "gapirmoq aytmoq oylamoq bilmoq tushunmoq kormoq eshitmoq his qilmoq sevmoq xohlamoq kerak mumkin bolmaydi "+
    "qilmoq bormoq kelmoq yugurmoq oqimoq yozmoq tinglamoq oynamoq ishlamoq organmoq dam olmoq uxlamoq turmoq "+
    "yotmoq boshlamoq tugatmoq davom etmoq yordam bermoq olmoq sotib olmoq sotmoq tolamoq qidirmoq topmoq "+
    "yoqotmoq unutmoq eslamoq hal qilmoq tanlamoq ozgartirmoq qolmoq bolmoq korinmoq yoqmoq xursand bolmoq "+
    "gamgin bolmoq qorqmoq ajablanmoq kulmoq yiglamoq qoshiq aytmoq raqsga tushmoq chizmoq qurmoq buzmoq "+
    "tuzatmoq ochmoq yopmoq ochirmoq kotarmoq tushirmoq tashlamoq ushlamoq olib bormoq kiritmoq chiqmoq kirmoq "+
    "qaytmoq tayyorlanmoq kiyinmoq yechinmoq yuvinmoq taranmoq nonushta qilmoq tushlik qilmoq kechki ovqat "+
    "yemoq ichmoq pishirmoq tozalamoq yuvmoq dazmollamoq bank dokon bozor narx chegirma mahsulot xaridor "+
    "sotuvchi kassa chek hisob maosh soliq kredit avtobus poyezd metro samolyot kema velosiped kocha maydon "+
    "koprik bino kvartira xona oshxona hammom hojatxona yotoqxona mehmonxona balkon zina tom devor bog hovli "+
    "ob-havo yomgir qor shamol tuman bulut chaqmoq kamalak sovuq issiqlik yorug qorongu erta kech baland ovoz "+
    "past ovoz uzoq yaqin baland past kop kam koproq kamroq yaxshiroq yomonroq yangi eski yosh keksa chiroyli "+
    "xunuk aqlli ahmoq mehribon yovuz kuchli ojiz boy kambagal toza iflos tolik bosh ogir yengil otkir otmas "+
    "shirin achchiq shor nordon mazali mazasiz").split(' '),
    kk: ("және бұл ол мен сен біз сіз олар бар жоқ келді кетті кітап үй жұмыс күн түн уақыт өмір адам бала "+
    "әке ана дос қала ауыл мектеп студент мұғалім компьютер интернет телефон машина жол су нан шай ас "+
    "базар дүкен ақша сабақ сұрақ жауап жақсы жаман үлкен кіші ыстық суық тез баяу биік аласа кең тар "+
    "ақ қара қызыл көк сары жасыл бүгін ертең кеше апта ай жыл сағат минут секунд көктем жаз күз қыс "+
    "тау теңіз өзен орман гүл ағаш жануар құс балық ит мысық ат сиыр сүт ет жеміс көкөніс алма жүзім "+
    "сөйлеу айту ойлау білу түсіну көру есту сезіну сүю қалау керек болады болмайды істеу бару келу жүгіру "+
    "оқу жазу тыңдау ойнау жұмыс істеу үйрену демалу ұйықтау тұру жату бастау аяқтау жалғастыру көмектесу "+
    "беру алу сатып алу сату төлеу іздеу табу жоғалту ұмыту есте сақтау шешу таңдау өзгерту қалу болу көріну "+
    "ұнау қуану мұңаю қорқу таңғалу күлу жылау ән айту би билеу сурет салу салу бұзу жөндеу ашу жабу қосу "+
    "өшіру көтеру түсіру лақтыру ұстау апару кіргізу шығу кіру қайту дайындалу киіну шешіну жуыну тарану "+
    "таңғы ас ішу түскі ас кешкі ас ішу тамақтану пісіру тазалау жуу үтіктеу ақша банк дүкен базар баға "+
    "жеңілдік тауар сатып алушы сатушы касса чек шот жалақы салық несие автобус пойыз метро ұшақ кеме "+
    "велосипед жол көше алаң көпір ғимарат пәтер бөлме асхана жуынатын бөлме дәретхана жатын бөлме балкон "+
    "баспалдақ шатыр қабырға бақ аула ауа райы жаңбыр қар жел тұман бұлт найзағай кемпірқосақ аяз жылу жарық "+
    "қараңғы ерте кеш тез баяу қатты дауыс ащы дауыс алыс жақын биік аласа көп аз көбірек азырақ жақсырақ "+
    "нашарлау жаңа ескі жас қарт әдемі ұсқынсыз ақылды ақымақ мейірімді зұлым күшті әлсіз бай кедей таза лас "+
    "толық бос ауыр жеңіл өткір мұқал тәтті ащы тұзды қышқыл дәмді дәмсіз").split(' '),
    ky: ("жана бул ал мен сен биз силер алар бар жок келди кетти китеп үй иш күн түн убакыт жашоо адам бала "+
    "ата эне дос шаар айыл мектеп студент мугалим компьютер интернет телефон машина жол суу нан чай ас "+
    "базар дүкөн акча сабак суроо жооп жакшы жаман чоң кичине ысык муздак тез жай бийик төмөн кең тар "+
    "ак кара кызыл көк сары жашыл бүгүн эртең кечээ жума ай жыл саат мүнөт секунд жаз күз кыш тоо "+
    "деңиз дарыя токой гүл дарак жаныбар куш балык ит мышык ат уй сүт эт мөмө жашылча алма жүзүм "+
    "сүйлөө айтуу ойлоо билүү түшүнүү көрүү угуу сезүү сүйүү каалоо керек болот болбойт кылуу баруу келүү "+
    "чуркоо окуу жазуу угуу ойноо иштөө үйрөнүү эс алуу уктоо туруу жатуу баштоо бүтүрүү улантуу жардам берүү "+
    "берүү алуу сатып алуу сатуу төлөө издөө табуу жоготуу унутуу эсте сактоо чечүү тандоо өзгөртүү калуу "+
    "болуу көрүнүү жагуу кубануу кайгыруу коркуу таң калуу күлүү ыйлоо ыр ырдоо бийлөө сүрөт тартуу куруу "+
    "бузуу оңдоо ачуу жабуу күйгүзүү өчүрүү көтөрүү түшүрүү ыргытуу кармоо алып баруу киргизүү чыгуу кирүү "+
    "кайтуу даярдануу кийинүү чечинүү жуунуу тарануу эртең мененки тамак түшкү тамак кечки тамак тамактануу "+
    "бышыруу тазалоо жуу үтүктөө акча банк дүкөн базар баа арзандатуу товар сатып алуучу сатуучу касса чек "+
    "эсеп айлык маяна салык кредит автобус поезд метро учак кеме велосипед жол көчө аянт көпүрө имарат батир "+
    "бөлмө ашкана жуунуучу бөлмө даараткана жатар бөлмө балкон тепкич чатыр дубал бак короо аба ырайы жамгыр "+
    "кар шамал туман булут чагылган асман жаа муздак жылуулук жарык караңгы эрте кеч тез жай катуу үн акырын "+
    "үн алыс жакын бийик жапыз көп аз көбүрөөк азыраак жакшыраак начар жаңы эски жаш карыя сулуу көрксүз "+
    "акылдуу акмак мээримдүү каардуу күчтүү алсыз бай кедей таза кир толук бош оор жеңил курч мокок таттуу "+
    "ачуу туздуу кычкыл даамдуу даамсыз").split(' '),
  };

  const codeSnippets = {
    python: [
"def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)",
"class Stack:\n    def __init__(self):\n        self.items = []\n    def push(self, item):\n        self.items.append(item)\n    def pop(self):\n        return self.items.pop()",
"def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    return quicksort(left)",
"def is_palindrome(s):\n    s = s.lower().replace(' ', '')\n    return s == s[::-1]",
"def binary_search(arr, target):\n    lo, hi = 0, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1",
"def factorial(n):\n    result = 1\n    for i in range(2, n + 1):\n        result *= i\n    return result",
"class Node:\n    def __init__(self, value):\n        self.value = value\n        self.next = None",
"def merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return left + right",
"def count_vowels(text):\n    vowels = set('aeiouAEIOU')\n    return sum(1 for ch in text if ch in vowels)",
"class Queue:\n    def __init__(self):\n        self.items = []\n    def enqueue(self, item):\n        self.items.append(item)\n    def dequeue(self):\n        return self.items.pop(0)",
"def gcd(a, b):\n    while b:\n        a, b = b, a % b\n    return a",
"def flatten(nested):\n    result = []\n    for item in nested:\n        if isinstance(item, list):\n            result.extend(flatten(item))\n        else:\n            result.append(item)\n    return result",
"def is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n ** 0.5) + 1):\n        if n % i == 0:\n            return False\n    return True",
"def reverse_words(sentence):\n    words = sentence.split()\n    return ' '.join(reversed(words))",
"class BankAccount:\n    def __init__(self, balance=0):\n        self.balance = balance\n    def deposit(self, amount):\n        self.balance += amount\n    def withdraw(self, amount):\n        if amount <= self.balance:\n            self.balance -= amount",
"def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i",
"def caesar_cipher(text, shift):\n    result = ''\n    for ch in text:\n        if ch.isalpha():\n            base = ord('a') if ch.islower() else ord('A')\n            result += chr((ord(ch) - base + shift) % 26 + base)\n        else:\n            result += ch\n    return result",
"def max_subarray(nums):\n    best = current = nums[0]\n    for n in nums[1:]:\n        current = max(n, current + n)\n        best = max(best, current)\n    return best",
"def word_frequency(text):\n    freq = {}\n    for word in text.split():\n        freq[word] = freq.get(word, 0) + 1\n    return freq",
"def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(0, n - i - 1):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr",
"def sum_digits(n):\n    n = abs(n)\n    total = 0\n    while n > 0:\n        total += n % 10\n        n //= 10\n    return total",
"def is_anagram(a, b):\n    return sorted(a.replace(' ', '').lower()) == sorted(b.replace(' ', '').lower())",
"class Animal:\n    def __init__(self, name):\n        self.name = name\n    def speak(self):\n        return f'{self.name} makes a sound'",
"def chunk_list(lst, size):\n    return [lst[i:i + size] for i in range(0, len(lst), size)]",
"def celsius_to_fahrenheit(c):\n    return c * 9 / 5 + 32",
"def remove_duplicates(items):\n    seen = set()\n    result = []\n    for item in items:\n        if item not in seen:\n            seen.add(item)\n            result.append(item)\n    return result",
"def matrix_transpose(matrix):\n    return [list(row) for row in zip(*matrix)]",
"class Timer:\n    def __init__(self):\n        self.laps = []\n    def lap(self, seconds):\n        self.laps.append(seconds)"
    ],
    javascript: [
"function debounce(fn, delay) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}",
"const fetchUser = async (id) => {\n  const res = await fetch(`/api/users/${id}`);\n  if (!res.ok) throw new Error('failed');\n  return res.json();\n};",
"class Queue {\n  constructor() {\n    this.items = [];\n  }\n  enqueue(item) {\n    this.items.push(item);\n  }\n}",
"function isPalindrome(str) {\n  const clean = str.toLowerCase().replace(/\\s/g, '');\n  return clean === clean.split('').reverse().join('');\n}",
"function binarySearch(arr, target) {\n  let lo = 0, hi = arr.length - 1;\n  while (lo <= hi) {\n    const mid = Math.floor((lo + hi) / 2);\n    if (arr[mid] === target) return mid;\n    arr[mid] < target ? lo = mid + 1 : hi = mid - 1;\n  }\n  return -1;\n}",
"function factorial(n) {\n  return n <= 1 ? 1 : n * factorial(n - 1);\n}",
"class LinkedListNode {\n  constructor(value) {\n    this.value = value;\n    this.next = null;\n  }\n}",
"function mergeSort(arr) {\n  if (arr.length <= 1) return arr;\n  const mid = Math.floor(arr.length / 2);\n  const left = mergeSort(arr.slice(0, mid));\n  const right = mergeSort(arr.slice(mid));\n  return [...left, ...right];\n}",
"function countVowels(text) {\n  return (text.match(/[aeiou]/gi) || []).length;\n}",
"function throttle(fn, limit) {\n  let inThrottle;\n  return (...args) => {\n    if (!inThrottle) {\n      fn(...args);\n      inThrottle = true;\n      setTimeout(() => inThrottle = false, limit);\n    }\n  };\n}",
"function gcd(a, b) {\n  return b === 0 ? a : gcd(b, a % b);\n}",
"function flatten(arr) {\n  return arr.reduce((flat, item) =>\n    flat.concat(Array.isArray(item) ? flatten(item) : item), []);\n}",
"function isPrime(n) {\n  if (n < 2) return false;\n  for (let i = 2; i * i <= n; i++) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}",
"function reverseWords(sentence) {\n  return sentence.split(' ').reverse().join(' ');\n}",
"class EventEmitter {\n  constructor() {\n    this.listeners = {};\n  }\n  on(event, cb) {\n    (this.listeners[event] ||= []).push(cb);\n  }\n}",
"function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n}",
"function deepClone(obj) {\n  return JSON.parse(JSON.stringify(obj));\n}",
"function maxSubArray(nums) {\n  let best = nums[0], current = nums[0];\n  for (let i = 1; i < nums.length; i++) {\n    current = Math.max(nums[i], current + nums[i]);\n    best = Math.max(best, current);\n  }\n  return best;\n}",
"function wordFrequency(text) {\n  const freq = {};\n  text.split(' ').forEach(w => freq[w] = (freq[w] || 0) + 1);\n  return freq;\n}",
"function bubbleSort(arr) {\n  for (let i = 0; i < arr.length; i++) {\n    for (let j = 0; j < arr.length - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];\n      }\n    }\n  }\n  return arr;\n}",
"function sumDigits(n) {\n  n = Math.abs(n);\n  let total = 0;\n  while (n > 0) {\n    total += n % 10;\n    n = Math.floor(n / 10);\n  }\n  return total;\n}",
"function isAnagram(a, b) {\n  const norm = s => s.replace(/\\s/g, '').toLowerCase().split('').sort().join('');\n  return norm(a) === norm(b);\n}",
"class Animal {\n  constructor(name) {\n    this.name = name;\n  }\n  speak() {\n    return `${this.name} makes a sound`;\n  }\n}",
"function chunkArray(arr, size) {\n  const result = [];\n  for (let i = 0; i < arr.length; i += size) {\n    result.push(arr.slice(i, i + size));\n  }\n  return result;\n}",
"function celsiusToFahrenheit(c) {\n  return c * 9 / 5 + 32;\n}",
"function removeDuplicates(arr) {\n  return [...new Set(arr)];\n}",
"function clamp(value, min, max) {\n  return Math.min(Math.max(value, min), max);\n}",
"class Timer {\n  constructor() {\n    this.laps = [];\n  }\n  lap(seconds) {\n    this.laps.push(seconds);\n  }\n}"
    ],
    cpp: [
"int binarySearch(vector<int>& arr, int target) {\n    int lo = 0, hi = arr.size() - 1;\n    while (lo <= hi) {\n        int mid = (lo + hi) / 2;\n        if (arr[mid] == target) return mid;\n    }\n    return -1;\n}",
"class Node {\npublic:\n    int value;\n    Node* next;\n    Node(int v) : value(v), next(nullptr) {}\n};",
"void bubbleSort(int arr[], int n) {\n    for (int i = 0; i < n - 1; i++)\n        for (int j = 0; j < n - i - 1; j++)\n            if (arr[j] > arr[j+1]) swap(arr[j], arr[j+1]);\n}",
"bool isPalindrome(string s) {\n    int left = 0, right = s.size() - 1;\n    while (left < right) {\n        if (s[left] != s[right]) return false;\n        left++; right--;\n    }\n    return true;\n}",
"int factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}",
"class Stack {\n    vector<int> data;\npublic:\n    void push(int x) { data.push_back(x); }\n    void pop() { data.pop_back(); }\n};",
"int gcd(int a, int b) {\n    while (b != 0) {\n        int t = b;\n        b = a % b;\n        a = t;\n    }\n    return a;\n}",
"bool isPrime(int n) {\n    if (n < 2) return false;\n    for (int i = 2; i * i <= n; i++) {\n        if (n % i == 0) return false;\n    }\n    return true;\n}",
"void mergeSort(vector<int>& arr, int l, int r) {\n    if (l >= r) return;\n    int mid = (l + r) / 2;\n    mergeSort(arr, l, mid);\n    mergeSort(arr, mid + 1, r);\n}",
"int maxSubArray(vector<int>& nums) {\n    int best = nums[0], current = nums[0];\n    for (int i = 1; i < nums.size(); i++) {\n        current = max(nums[i], current + nums[i]);\n        best = max(best, current);\n    }\n    return best;\n}",
"struct Point {\n    double x, y;\n    Point(double x, double y) : x(x), y(y) {}\n};",
"vector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int, int> seen;\n    for (int i = 0; i < nums.size(); i++) {\n        if (seen.count(target - nums[i])) return {seen[target - nums[i]], i};\n        seen[nums[i]] = i;\n    }\n    return {};\n}",
"class Queue {\n    queue<int> data;\npublic:\n    void enqueue(int x) { data.push(x); }\n    int dequeue() { int v = data.front(); data.pop(); return v; }\n};",
"int fibonacci(int n) {\n    if (n <= 1) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}",
"void reverseArray(int arr[], int n) {\n    for (int i = 0; i < n / 2; i++)\n        swap(arr[i], arr[n - 1 - i]);\n}",
"int countVowels(string text) {\n    int count = 0;\n    for (char c : text) {\n        if (strchr(\"aeiouAEIOU\", c)) count++;\n    }\n    return count;\n}",
"class Rectangle {\n    double width, height;\npublic:\n    Rectangle(double w, double h) : width(w), height(h) {}\n    double area() { return width * height; }\n};",
"int linearSearch(vector<int>& arr, int target) {\n    for (int i = 0; i < arr.size(); i++) {\n        if (arr[i] == target) return i;\n    }\n    return -1;\n}",
"void insertionSort(int arr[], int n) {\n    for (int i = 1; i < n; i++) {\n        int key = arr[i], j = i - 1;\n        while (j >= 0 && arr[j] > key) arr[j + 1] = arr[j--];\n        arr[j + 1] = key;\n    }\n}",
"long power(long base, int exp) {\n    long result = 1;\n    while (exp > 0) {\n        if (exp % 2 == 1) result *= base;\n        base *= base;\n        exp /= 2;\n    }\n    return result;\n}",
"int sumDigits(int n) {\n    n = abs(n);\n    int total = 0;\n    while (n > 0) {\n        total += n % 10;\n        n /= 10;\n    }\n    return total;\n}",
"double celsiusToFahrenheit(double c) {\n    return c * 9.0 / 5.0 + 32.0;\n}",
"class Animal {\n    string name;\npublic:\n    Animal(string n) : name(n) {}\n    string speak() { return name + \" makes a sound\"; }\n};",
"int clamp(int value, int lo, int hi) {\n    return max(lo, min(value, hi));\n}",
"vector<int> removeDuplicates(vector<int>& arr) {\n    set<int> seen(arr.begin(), arr.end());\n    return vector<int>(seen.begin(), seen.end());\n}",
"int arraySum(int arr[], int n) {\n    int total = 0;\n    for (int i = 0; i < n; i++) total += arr[i];\n    return total;\n}",
"class Timer {\n    vector<double> laps;\npublic:\n    void lap(double seconds) { laps.push_back(seconds); }\n};",
"bool isSorted(vector<int>& arr) {\n    for (int i = 1; i < arr.size(); i++) {\n        if (arr[i] < arr[i - 1]) return false;\n    }\n    return true;\n}"
    ],
    java: [
"public int fibonacci(int n) {\n    if (n <= 1) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}",
"public class Node {\n    int value;\n    Node next;\n    Node(int value) {\n        this.value = value;\n    }\n}",
"public boolean isPalindrome(String s) {\n    String clean = s.toLowerCase().replace(\" \", \"\");\n    return clean.equals(new StringBuilder(clean).reverse().toString());\n}",
"public int binarySearch(int[] arr, int target) {\n    int lo = 0, hi = arr.length - 1;\n    while (lo <= hi) {\n        int mid = (lo + hi) / 2;\n        if (arr[mid] == target) return mid;\n        if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;\n    }\n    return -1;\n}",
"public int factorial(int n) {\n    int result = 1;\n    for (int i = 2; i <= n; i++) result *= i;\n    return result;\n}",
"public class Stack {\n    private List<Integer> items = new ArrayList<>();\n    public void push(int x) { items.add(x); }\n    public int pop() { return items.remove(items.size() - 1); }\n}",
"public int gcd(int a, int b) {\n    while (b != 0) {\n        int t = b;\n        b = a % b;\n        a = t;\n    }\n    return a;\n}",
"public boolean isPrime(int n) {\n    if (n < 2) return false;\n    for (int i = 2; i * i <= n; i++) {\n        if (n % i == 0) return false;\n    }\n    return true;\n}",
"public void bubbleSort(int[] arr) {\n    for (int i = 0; i < arr.length - 1; i++) {\n        for (int j = 0; j < arr.length - i - 1; j++) {\n            if (arr[j] > arr[j + 1]) {\n                int t = arr[j]; arr[j] = arr[j+1]; arr[j+1] = t;\n            }\n        }\n    }\n}",
"public int[] twoSum(int[] nums, int target) {\n    Map<Integer, Integer> seen = new HashMap<>();\n    for (int i = 0; i < nums.length; i++) {\n        if (seen.containsKey(target - nums[i])) {\n            return new int[]{seen.get(target - nums[i]), i};\n        }\n        seen.put(nums[i], i);\n    }\n    return new int[]{};\n}",
"public class BankAccount {\n    private double balance;\n    public void deposit(double amount) {\n        balance += amount;\n    }\n    public void withdraw(double amount) {\n        if (amount <= balance) balance -= amount;\n    }\n}",
"public String reverseWords(String sentence) {\n    String[] words = sentence.split(\" \");\n    StringBuilder result = new StringBuilder();\n    for (int i = words.length - 1; i >= 0; i--) result.append(words[i]).append(\" \");\n    return result.toString().trim();\n}",
"public int maxSubArray(int[] nums) {\n    int best = nums[0], current = nums[0];\n    for (int i = 1; i < nums.length; i++) {\n        current = Math.max(nums[i], current + nums[i]);\n        best = Math.max(best, current);\n    }\n    return best;\n}",
"public class Queue {\n    private LinkedList<Integer> items = new LinkedList<>();\n    public void enqueue(int x) { items.addLast(x); }\n    public int dequeue() { return items.removeFirst(); }\n}",
"public int countVowels(String text) {\n    int count = 0;\n    for (char c : text.toLowerCase().toCharArray()) {\n        if (\"aeiou\".indexOf(c) >= 0) count++;\n    }\n    return count;\n}",
"public void mergeSort(int[] arr, int l, int r) {\n    if (l >= r) return;\n    int mid = (l + r) / 2;\n    mergeSort(arr, l, mid);\n    mergeSort(arr, mid + 1, r);\n}",
"public class Point {\n    double x, y;\n    public Point(double x, double y) {\n        this.x = x;\n        this.y = y;\n    }\n}",
"public int linearSearch(int[] arr, int target) {\n    for (int i = 0; i < arr.length; i++) {\n        if (arr[i] == target) return i;\n    }\n    return -1;\n}",
"public long power(long base, int exp) {\n    long result = 1;\n    while (exp > 0) {\n        if (exp % 2 == 1) result *= base;\n        base *= base;\n        exp /= 2;\n    }\n    return result;\n}",
"public Map<String, Integer> wordFrequency(String text) {\n    Map<String, Integer> freq = new HashMap<>();\n    for (String w : text.split(\" \")) {\n        freq.put(w, freq.getOrDefault(w, 0) + 1);\n    }\n    return freq;\n}",
"public int sumDigits(int n) {\n    n = Math.abs(n);\n    int total = 0;\n    while (n > 0) {\n        total += n % 10;\n        n /= 10;\n    }\n    return total;\n}",
"public double celsiusToFahrenheit(double c) {\n    return c * 9 / 5 + 32;\n}",
"public class Animal {\n    private String name;\n    public Animal(String name) {\n        this.name = name;\n    }\n    public String speak() {\n        return name + \" makes a sound\";\n    }\n}",
"public int clamp(int value, int lo, int hi) {\n    return Math.max(lo, Math.min(value, hi));\n}",
"public List<Integer> removeDuplicates(List<Integer> list) {\n    return new ArrayList<>(new LinkedHashSet<>(list));\n}",
"public boolean isSorted(int[] arr) {\n    for (int i = 1; i < arr.length; i++) {\n        if (arr[i] < arr[i - 1]) return false;\n    }\n    return true;\n}",
"public class Timer {\n    private List<Double> laps = new ArrayList<>();\n    public void lap(double seconds) {\n        laps.add(seconds);\n    }\n}",
"public int arraySum(int[] arr) {\n    int total = 0;\n    for (int x : arr) total += x;\n    return total;\n}"
    ],
    csharp: [
"public int Fibonacci(int n) {\n    if (n <= 1) return n;\n    return Fibonacci(n - 1) + Fibonacci(n - 2);\n}",
"public class Node {\n    public int Value;\n    public Node Next;\n    public Node(int value) {\n        Value = value;\n    }\n}",
"public bool IsPalindrome(string s) {\n    var clean = s.ToLower().Replace(\" \", \"\");\n    var reversed = new string(clean.Reverse().ToArray());\n    return clean == reversed;\n}",
"public int BinarySearch(int[] arr, int target) {\n    int lo = 0, hi = arr.Length - 1;\n    while (lo <= hi) {\n        int mid = (lo + hi) / 2;\n        if (arr[mid] == target) return mid;\n        if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;\n    }\n    return -1;\n}",
"public int Factorial(int n) {\n    int result = 1;\n    for (int i = 2; i <= n; i++) result *= i;\n    return result;\n}",
"public class Stack {\n    private List<int> items = new List<int>();\n    public void Push(int x) => items.Add(x);\n    public int Pop() {\n        var last = items[items.Count - 1];\n        items.RemoveAt(items.Count - 1);\n        return last;\n    }\n}",
"public int Gcd(int a, int b) {\n    while (b != 0) {\n        int t = b;\n        b = a % b;\n        a = t;\n    }\n    return a;\n}",
"public bool IsPrime(int n) {\n    if (n < 2) return false;\n    for (int i = 2; i * i <= n; i++) {\n        if (n % i == 0) return false;\n    }\n    return true;\n}",
"public void BubbleSort(int[] arr) {\n    for (int i = 0; i < arr.Length - 1; i++) {\n        for (int j = 0; j < arr.Length - i - 1; j++) {\n            if (arr[j] > arr[j + 1]) {\n                (arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);\n            }\n        }\n    }\n}",
"public int[] TwoSum(int[] nums, int target) {\n    var seen = new Dictionary<int, int>();\n    for (int i = 0; i < nums.Length; i++) {\n        if (seen.ContainsKey(target - nums[i])) {\n            return new int[] { seen[target - nums[i]], i };\n        }\n        seen[nums[i]] = i;\n    }\n    return new int[] { };\n}",
"public class BankAccount {\n    private decimal balance;\n    public void Deposit(decimal amount) {\n        balance += amount;\n    }\n    public void Withdraw(decimal amount) {\n        if (amount <= balance) balance -= amount;\n    }\n}",
"public string ReverseWords(string sentence) {\n    var words = sentence.Split(' ');\n    Array.Reverse(words);\n    return string.Join(\" \", words);\n}",
"public int MaxSubArray(int[] nums) {\n    int best = nums[0], current = nums[0];\n    for (int i = 1; i < nums.Length; i++) {\n        current = Math.Max(nums[i], current + nums[i]);\n        best = Math.Max(best, current);\n    }\n    return best;\n}",
"public class Queue {\n    private LinkedList<int> items = new LinkedList<int>();\n    public void Enqueue(int x) => items.AddLast(x);\n    public int Dequeue() {\n        var v = items.First.Value;\n        items.RemoveFirst();\n        return v;\n    }\n}",
"public int CountVowels(string text) {\n    int count = 0;\n    foreach (var c in text.ToLower()) {\n        if (\"aeiou\".IndexOf(c) >= 0) count++;\n    }\n    return count;\n}",
"public class Point {\n    public double X, Y;\n    public Point(double x, double y) {\n        X = x;\n        Y = y;\n    }\n}",
"public int LinearSearch(int[] arr, int target) {\n    for (int i = 0; i < arr.Length; i++) {\n        if (arr[i] == target) return i;\n    }\n    return -1;\n}",
"public long Power(long baseNum, int exp) {\n    long result = 1;\n    while (exp > 0) {\n        if (exp % 2 == 1) result *= baseNum;\n        baseNum *= baseNum;\n        exp /= 2;\n    }\n    return result;\n}",
"public Dictionary<string,int> WordFrequency(string text) {\n    var freq = new Dictionary<string,int>();\n    foreach (var w in text.Split(' ')) {\n        freq[w] = freq.GetValueOrDefault(w, 0) + 1;\n    }\n    return freq;\n}",
"public void InsertionSort(int[] arr) {\n    for (int i = 1; i < arr.Length; i++) {\n        int key = arr[i], j = i - 1;\n        while (j >= 0 && arr[j] > key) arr[j + 1] = arr[j--];\n        arr[j + 1] = key;\n    }\n}",
"public int SumDigits(int n) {\n    n = Math.Abs(n);\n    int total = 0;\n    while (n > 0) {\n        total += n % 10;\n        n /= 10;\n    }\n    return total;\n}",
"public double CelsiusToFahrenheit(double c) {\n    return c * 9 / 5 + 32;\n}",
"public class Animal {\n    private string name;\n    public Animal(string name) {\n        this.name = name;\n    }\n    public string Speak() => name + \" makes a sound\";\n}",
"public int Clamp(int value, int lo, int hi) {\n    return Math.Max(lo, Math.Min(value, hi));\n}",
"public List<int> RemoveDuplicates(List<int> list) {\n    return list.Distinct().ToList();\n}",
"public bool IsSorted(int[] arr) {\n    for (int i = 1; i < arr.Length; i++) {\n        if (arr[i] < arr[i - 1]) return false;\n    }\n    return true;\n}",
"public class Timer {\n    private List<double> laps = new List<double>();\n    public void Lap(double seconds) => laps.Add(seconds);\n}",
"public int ArraySum(int[] arr) {\n    int total = 0;\n    foreach (var x in arr) total += x;\n    return total;\n}"
    ],
    c: [
"int fibonacci(int n) {\n    if (n <= 1) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}",
"struct Node {\n    int value;\n    struct Node* next;\n};",
"int isPalindrome(char* s, int len) {\n    for (int i = 0; i < len / 2; i++) {\n        if (s[i] != s[len - 1 - i]) return 0;\n    }\n    return 1;\n}",
"int binarySearch(int arr[], int n, int target) {\n    int lo = 0, hi = n - 1;\n    while (lo <= hi) {\n        int mid = (lo + hi) / 2;\n        if (arr[mid] == target) return mid;\n        if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;\n    }\n    return -1;\n}",
"int factorial(int n) {\n    int result = 1;\n    for (int i = 2; i <= n; i++) result *= i;\n    return result;\n}",
"void bubbleSort(int arr[], int n) {\n    for (int i = 0; i < n - 1; i++) {\n        for (int j = 0; j < n - i - 1; j++) {\n            if (arr[j] > arr[j + 1]) {\n                int t = arr[j];\n                arr[j] = arr[j + 1];\n                arr[j + 1] = t;\n            }\n        }\n    }\n}",
"int gcd(int a, int b) {\n    while (b != 0) {\n        int t = b;\n        b = a % b;\n        a = t;\n    }\n    return a;\n}",
"int isPrime(int n) {\n    if (n < 2) return 0;\n    for (int i = 2; i * i <= n; i++) {\n        if (n % i == 0) return 0;\n    }\n    return 1;\n}",
"void reverseArray(int arr[], int n) {\n    for (int i = 0; i < n / 2; i++) {\n        int t = arr[i];\n        arr[i] = arr[n - 1 - i];\n        arr[n - 1 - i] = t;\n    }\n}",
"int countVowels(char* text) {\n    int count = 0;\n    for (int i = 0; text[i]; i++) {\n        if (strchr(\"aeiouAEIOU\", text[i])) count++;\n    }\n    return count;\n}",
"struct Point {\n    double x;\n    double y;\n};",
"void swap(int* a, int* b) {\n    int temp = *a;\n    *a = *b;\n    *b = temp;\n}",
"int linearSearch(int arr[], int n, int target) {\n    for (int i = 0; i < n; i++) {\n        if (arr[i] == target) return i;\n    }\n    return -1;\n}",
"void insertionSort(int arr[], int n) {\n    for (int i = 1; i < n; i++) {\n        int key = arr[i];\n        int j = i - 1;\n        while (j >= 0 && arr[j] > key) {\n            arr[j + 1] = arr[j];\n            j--;\n        }\n        arr[j + 1] = key;\n    }\n}",
"long power(long base, int exp) {\n    long result = 1;\n    while (exp > 0) {\n        if (exp % 2 == 1) result *= base;\n        base *= base;\n        exp /= 2;\n    }\n    return result;\n}",
"int sumArray(int arr[], int n) {\n    int sum = 0;\n    for (int i = 0; i < n; i++) sum += arr[i];\n    return sum;\n}",
"int findMax(int arr[], int n) {\n    int max = arr[0];\n    for (int i = 1; i < n; i++) {\n        if (arr[i] > max) max = arr[i];\n    }\n    return max;\n}",
"void printPattern(int n) {\n    for (int i = 1; i <= n; i++) {\n        for (int j = 0; j < i; j++) printf(\"*\");\n        printf(\"\\n\");\n    }\n}",
"int strLength(char* s) {\n    int len = 0;\n    while (s[len] != '\\0') len++;\n    return len;\n}",
"struct Rectangle {\n    int width;\n    int height;\n};",
"int sumDigits(int n) {\n    n = abs(n);\n    int total = 0;\n    while (n > 0) {\n        total += n % 10;\n        n /= 10;\n    }\n    return total;\n}",
"double celsiusToFahrenheit(double c) {\n    return c * 9.0 / 5.0 + 32.0;\n}",
"int isSorted(int arr[], int n) {\n    for (int i = 1; i < n; i++) {\n        if (arr[i] < arr[i - 1]) return 0;\n    }\n    return 1;\n}",
"int clamp(int value, int lo, int hi) {\n    if (value < lo) return lo;\n    if (value > hi) return hi;\n    return value;\n}",
"void copyArray(int src[], int dest[], int n) {\n    for (int i = 0; i < n; i++) dest[i] = src[i];\n}",
"int countOccurrences(int arr[], int n, int target) {\n    int count = 0;\n    for (int i = 0; i < n; i++) {\n        if (arr[i] == target) count++;\n    }\n    return count;\n}",
"void reverseString(char* s, int len) {\n    for (int i = 0; i < len / 2; i++) {\n        char t = s[i];\n        s[i] = s[len - 1 - i];\n        s[len - 1 - i] = t;\n    }\n}",
"int average(int arr[], int n) {\n    int sum = 0;\n    for (int i = 0; i < n; i++) sum += arr[i];\n    return n > 0 ? sum / n : 0;\n}"
    ]
  };
  function randomWords(n, lang){
    const bank = wordBanks[lang] || wordBanks.en;
    const out = [];
    for(let i=0;i<n;i++) out.push(bank[Math.floor(Math.random()*bank.length)]);
    return out.join(' ');
  }
  function randomCode(lang){
    const arr = codeSnippets[lang];
    return arr[Math.floor(Math.random()*arr.length)];
  }

