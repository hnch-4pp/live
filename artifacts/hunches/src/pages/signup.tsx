import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "@/lib/apiFetch";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Search, ChevronDown, Eye, EyeOff, Lock, AtSign, Check, X, Loader2, Ticket, Users, User, Newspaper, Mic2, Globe, Instagram, Twitter, Youtube, Music2, Facebook, Bot, Twitch, Linkedin, MessageSquare, HelpCircle } from "lucide-react";
import { AddressAutocomplete, type ParsedAddress } from "@/components/address-autocomplete";

// ── Country data ─────────────────────────────────────────────────────────────

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  // ── Americas ──────────────────────────────────────────────────────────────
  { code: "MX", name: "Mexico",                          dial: "+52",   flag: "🇲🇽" },
  { code: "US", name: "United States",                   dial: "+1",    flag: "🇺🇸" },
  { code: "CA", name: "Canada",                          dial: "+1",    flag: "🇨🇦" },
  { code: "AR", name: "Argentina",                       dial: "+54",   flag: "🇦🇷" },
  { code: "BR", name: "Brazil",                          dial: "+55",   flag: "🇧🇷" },
  { code: "CL", name: "Chile",                           dial: "+56",   flag: "🇨🇱" },
  { code: "CO", name: "Colombia",                        dial: "+57",   flag: "🇨🇴" },
  { code: "PE", name: "Peru",                            dial: "+51",   flag: "🇵🇪" },
  { code: "VE", name: "Venezuela",                       dial: "+58",   flag: "🇻🇪" },
  { code: "EC", name: "Ecuador",                         dial: "+593",  flag: "🇪🇨" },
  { code: "BO", name: "Bolivia",                         dial: "+591",  flag: "🇧🇴" },
  { code: "PY", name: "Paraguay",                        dial: "+595",  flag: "🇵🇾" },
  { code: "UY", name: "Uruguay",                         dial: "+598",  flag: "🇺🇾" },
  { code: "GT", name: "Guatemala",                       dial: "+502",  flag: "🇬🇹" },
  { code: "CU", name: "Cuba",                            dial: "+53",   flag: "🇨🇺" },
  { code: "DO", name: "Dominican Republic",              dial: "+1",    flag: "🇩🇴" },
  { code: "HN", name: "Honduras",                        dial: "+504",  flag: "🇭🇳" },
  { code: "SV", name: "El Salvador",                     dial: "+503",  flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua",                       dial: "+505",  flag: "🇳🇮" },
  { code: "CR", name: "Costa Rica",                      dial: "+506",  flag: "🇨🇷" },
  { code: "PA", name: "Panama",                          dial: "+507",  flag: "🇵🇦" },
  { code: "PR", name: "Puerto Rico",                     dial: "+1",    flag: "🇵🇷" },
  { code: "JM", name: "Jamaica",                         dial: "+1",    flag: "🇯🇲" },
  { code: "TT", name: "Trinidad and Tobago",             dial: "+1",    flag: "🇹🇹" },
  { code: "BB", name: "Barbados",                        dial: "+1",    flag: "🇧🇧" },
  { code: "BS", name: "Bahamas",                         dial: "+1",    flag: "🇧🇸" },
  { code: "BZ", name: "Belize",                          dial: "+501",  flag: "🇧🇿" },
  { code: "GY", name: "Guyana",                          dial: "+592",  flag: "🇬🇾" },
  { code: "SR", name: "Suriname",                        dial: "+597",  flag: "🇸🇷" },
  { code: "HT", name: "Haiti",                           dial: "+509",  flag: "🇭🇹" },
  { code: "GP", name: "Guadeloupe",                      dial: "+590",  flag: "🇬🇵" },
  { code: "MQ", name: "Martinique",                      dial: "+596",  flag: "🇲🇶" },
  { code: "LC", name: "Saint Lucia",                     dial: "+1",    flag: "🇱🇨" },
  { code: "VC", name: "Saint Vincent and the Grenadines",dial: "+1",    flag: "🇻🇨" },
  { code: "GD", name: "Grenada",                         dial: "+1",    flag: "🇬🇩" },
  { code: "DM", name: "Dominica",                        dial: "+1",    flag: "🇩🇲" },
  { code: "AG", name: "Antigua and Barbuda",             dial: "+1",    flag: "🇦🇬" },
  { code: "KN", name: "Saint Kitts and Nevis",           dial: "+1",    flag: "🇰🇳" },
  { code: "VI", name: "U.S. Virgin Islands",             dial: "+1",    flag: "🇻🇮" },
  // ── Europe ────────────────────────────────────────────────────────────────
  { code: "GB", name: "United Kingdom",                  dial: "+44",   flag: "🇬🇧" },
  { code: "ES", name: "Spain",                           dial: "+34",   flag: "🇪🇸" },
  { code: "FR", name: "France",                          dial: "+33",   flag: "🇫🇷" },
  { code: "DE", name: "Germany",                         dial: "+49",   flag: "🇩🇪" },
  { code: "IT", name: "Italy",                           dial: "+39",   flag: "🇮🇹" },
  { code: "PT", name: "Portugal",                        dial: "+351",  flag: "🇵🇹" },
  { code: "NL", name: "Netherlands",                     dial: "+31",   flag: "🇳🇱" },
  { code: "BE", name: "Belgium",                         dial: "+32",   flag: "🇧🇪" },
  { code: "SE", name: "Sweden",                          dial: "+46",   flag: "🇸🇪" },
  { code: "NO", name: "Norway",                          dial: "+47",   flag: "🇳🇴" },
  { code: "DK", name: "Denmark",                         dial: "+45",   flag: "🇩🇰" },
  { code: "FI", name: "Finland",                         dial: "+358",  flag: "🇫🇮" },
  { code: "CH", name: "Switzerland",                     dial: "+41",   flag: "🇨🇭" },
  { code: "AT", name: "Austria",                         dial: "+43",   flag: "🇦🇹" },
  { code: "PL", name: "Poland",                          dial: "+48",   flag: "🇵🇱" },
  { code: "CZ", name: "Czech Republic",                  dial: "+420",  flag: "🇨🇿" },
  { code: "SK", name: "Slovakia",                        dial: "+421",  flag: "🇸🇰" },
  { code: "HU", name: "Hungary",                         dial: "+36",   flag: "🇭🇺" },
  { code: "RO", name: "Romania",                         dial: "+40",   flag: "🇷🇴" },
  { code: "BG", name: "Bulgaria",                        dial: "+359",  flag: "🇧🇬" },
  { code: "GR", name: "Greece",                          dial: "+30",   flag: "🇬🇷" },
  { code: "HR", name: "Croatia",                         dial: "+385",  flag: "🇭🇷" },
  { code: "RS", name: "Serbia",                          dial: "+381",  flag: "🇷🇸" },
  { code: "SI", name: "Slovenia",                        dial: "+386",  flag: "🇸🇮" },
  { code: "BA", name: "Bosnia and Herzegovina",          dial: "+387",  flag: "🇧🇦" },
  { code: "MK", name: "North Macedonia",                 dial: "+389",  flag: "🇲🇰" },
  { code: "ME", name: "Montenegro",                      dial: "+382",  flag: "🇲🇪" },
  { code: "AL", name: "Albania",                         dial: "+355",  flag: "🇦🇱" },
  { code: "XK", name: "Kosovo",                          dial: "+383",  flag: "🇽🇰" },
  { code: "IE", name: "Ireland",                         dial: "+353",  flag: "🇮🇪" },
  { code: "IS", name: "Iceland",                         dial: "+354",  flag: "🇮🇸" },
  { code: "LU", name: "Luxembourg",                      dial: "+352",  flag: "🇱🇺" },
  { code: "MT", name: "Malta",                           dial: "+356",  flag: "🇲🇹" },
  { code: "CY", name: "Cyprus",                          dial: "+357",  flag: "🇨🇾" },
  { code: "EE", name: "Estonia",                         dial: "+372",  flag: "🇪🇪" },
  { code: "LV", name: "Latvia",                          dial: "+371",  flag: "🇱🇻" },
  { code: "LT", name: "Lithuania",                       dial: "+370",  flag: "🇱🇹" },
  { code: "BY", name: "Belarus",                         dial: "+375",  flag: "🇧🇾" },
  { code: "UA", name: "Ukraine",                         dial: "+380",  flag: "🇺🇦" },
  { code: "MD", name: "Moldova",                         dial: "+373",  flag: "🇲🇩" },
  { code: "RU", name: "Russia",                          dial: "+7",    flag: "🇷🇺" },
  { code: "LI", name: "Liechtenstein",                   dial: "+423",  flag: "🇱🇮" },
  { code: "MC", name: "Monaco",                          dial: "+377",  flag: "🇲🇨" },
  { code: "SM", name: "San Marino",                      dial: "+378",  flag: "🇸🇲" },
  { code: "AD", name: "Andorra",                         dial: "+376",  flag: "🇦🇩" },
  { code: "VA", name: "Vatican City",                    dial: "+39",   flag: "🇻🇦" },
  // ── Africa ────────────────────────────────────────────────────────────────
  { code: "NG", name: "Nigeria",                         dial: "+234",  flag: "🇳🇬" },
  { code: "ZA", name: "South Africa",                    dial: "+27",   flag: "🇿🇦" },
  { code: "KE", name: "Kenya",                           dial: "+254",  flag: "🇰🇪" },
  { code: "GH", name: "Ghana",                           dial: "+233",  flag: "🇬🇭" },
  { code: "ET", name: "Ethiopia",                        dial: "+251",  flag: "🇪🇹" },
  { code: "TZ", name: "Tanzania",                        dial: "+255",  flag: "🇹🇿" },
  { code: "UG", name: "Uganda",                          dial: "+256",  flag: "🇺🇬" },
  { code: "EG", name: "Egypt",                           dial: "+20",   flag: "🇪🇬" },
  { code: "DZ", name: "Algeria",                         dial: "+213",  flag: "🇩🇿" },
  { code: "MA", name: "Morocco",                         dial: "+212",  flag: "🇲🇦" },
  { code: "TN", name: "Tunisia",                         dial: "+216",  flag: "🇹🇳" },
  { code: "LY", name: "Libya",                           dial: "+218",  flag: "🇱🇾" },
  { code: "SD", name: "Sudan",                           dial: "+249",  flag: "🇸🇩" },
  { code: "SS", name: "South Sudan",                     dial: "+211",  flag: "🇸🇸" },
  { code: "CM", name: "Cameroon",                        dial: "+237",  flag: "🇨🇲" },
  { code: "CI", name: "Ivory Coast",                     dial: "+225",  flag: "🇨🇮" },
  { code: "SN", name: "Senegal",                         dial: "+221",  flag: "🇸🇳" },
  { code: "ML", name: "Mali",                            dial: "+223",  flag: "🇲🇱" },
  { code: "BF", name: "Burkina Faso",                    dial: "+226",  flag: "🇧🇫" },
  { code: "NE", name: "Niger",                           dial: "+227",  flag: "🇳🇪" },
  { code: "TD", name: "Chad",                            dial: "+235",  flag: "🇹🇩" },
  { code: "MR", name: "Mauritania",                      dial: "+222",  flag: "🇲🇷" },
  { code: "GN", name: "Guinea",                          dial: "+224",  flag: "🇬🇳" },
  { code: "BJ", name: "Benin",                           dial: "+229",  flag: "🇧🇯" },
  { code: "TG", name: "Togo",                            dial: "+228",  flag: "🇹🇬" },
  { code: "SL", name: "Sierra Leone",                    dial: "+232",  flag: "🇸🇱" },
  { code: "LR", name: "Liberia",                         dial: "+231",  flag: "🇱🇷" },
  { code: "GW", name: "Guinea-Bissau",                   dial: "+245",  flag: "🇬🇼" },
  { code: "GM", name: "Gambia",                          dial: "+220",  flag: "🇬🇲" },
  { code: "CV", name: "Cape Verde",                      dial: "+238",  flag: "🇨🇻" },
  { code: "ST", name: "São Tomé and Príncipe",           dial: "+239",  flag: "🇸🇹" },
  { code: "GQ", name: "Equatorial Guinea",               dial: "+240",  flag: "🇬🇶" },
  { code: "GA", name: "Gabon",                           dial: "+241",  flag: "🇬🇦" },
  { code: "CG", name: "Republic of the Congo",           dial: "+242",  flag: "🇨🇬" },
  { code: "CD", name: "DR Congo",                        dial: "+243",  flag: "🇨🇩" },
  { code: "CF", name: "Central African Republic",        dial: "+236",  flag: "🇨🇫" },
  { code: "AO", name: "Angola",                          dial: "+244",  flag: "🇦🇴" },
  { code: "ZM", name: "Zambia",                          dial: "+260",  flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe",                        dial: "+263",  flag: "🇿🇼" },
  { code: "MW", name: "Malawi",                          dial: "+265",  flag: "🇲🇼" },
  { code: "MZ", name: "Mozambique",                      dial: "+258",  flag: "🇲🇿" },
  { code: "MG", name: "Madagascar",                      dial: "+261",  flag: "🇲🇬" },
  { code: "NA", name: "Namibia",                         dial: "+264",  flag: "🇳🇦" },
  { code: "BW", name: "Botswana",                        dial: "+267",  flag: "🇧🇼" },
  { code: "LS", name: "Lesotho",                         dial: "+266",  flag: "🇱🇸" },
  { code: "SZ", name: "Eswatini",                        dial: "+268",  flag: "🇸🇿" },
  { code: "MU", name: "Mauritius",                       dial: "+230",  flag: "🇲🇺" },
  { code: "SC", name: "Seychelles",                      dial: "+248",  flag: "🇸🇨" },
  { code: "KM", name: "Comoros",                         dial: "+269",  flag: "🇰🇲" },
  { code: "DJ", name: "Djibouti",                        dial: "+253",  flag: "🇩🇯" },
  { code: "ER", name: "Eritrea",                         dial: "+291",  flag: "🇪🇷" },
  { code: "SO", name: "Somalia",                         dial: "+252",  flag: "🇸🇴" },
  { code: "RW", name: "Rwanda",                          dial: "+250",  flag: "🇷🇼" },
  { code: "BI", name: "Burundi",                         dial: "+257",  flag: "🇧🇮" },
  // ── Middle East ───────────────────────────────────────────────────────────
  { code: "SA", name: "Saudi Arabia",                    dial: "+966",  flag: "🇸🇦" },
  { code: "AE", name: "United Arab Emirates",            dial: "+971",  flag: "🇦🇪" },
  { code: "IL", name: "Israel",                          dial: "+972",  flag: "🇮🇱" },
  { code: "TR", name: "Turkey",                          dial: "+90",   flag: "🇹🇷" },
  { code: "IQ", name: "Iraq",                            dial: "+964",  flag: "🇮🇶" },
  { code: "IR", name: "Iran",                            dial: "+98",   flag: "🇮🇷" },
  { code: "JO", name: "Jordan",                          dial: "+962",  flag: "🇯🇴" },
  { code: "LB", name: "Lebanon",                         dial: "+961",  flag: "🇱🇧" },
  { code: "SY", name: "Syria",                           dial: "+963",  flag: "🇸🇾" },
  { code: "PS", name: "Palestine",                       dial: "+970",  flag: "🇵🇸" },
  { code: "KW", name: "Kuwait",                          dial: "+965",  flag: "🇰🇼" },
  { code: "QA", name: "Qatar",                           dial: "+974",  flag: "🇶🇦" },
  { code: "BH", name: "Bahrain",                         dial: "+973",  flag: "🇧🇭" },
  { code: "OM", name: "Oman",                            dial: "+968",  flag: "🇴🇲" },
  { code: "YE", name: "Yemen",                           dial: "+967",  flag: "🇾🇪" },
  // ── Asia ──────────────────────────────────────────────────────────────────
  { code: "IN", name: "India",                           dial: "+91",   flag: "🇮🇳" },
  { code: "CN", name: "China",                           dial: "+86",   flag: "🇨🇳" },
  { code: "JP", name: "Japan",                           dial: "+81",   flag: "🇯🇵" },
  { code: "KR", name: "South Korea",                     dial: "+82",   flag: "🇰🇷" },
  { code: "SG", name: "Singapore",                       dial: "+65",   flag: "🇸🇬" },
  { code: "TH", name: "Thailand",                        dial: "+66",   flag: "🇹🇭" },
  { code: "VN", name: "Vietnam",                         dial: "+84",   flag: "🇻🇳" },
  { code: "ID", name: "Indonesia",                       dial: "+62",   flag: "🇮🇩" },
  { code: "MY", name: "Malaysia",                        dial: "+60",   flag: "🇲🇾" },
  { code: "PH", name: "Philippines",                     dial: "+63",   flag: "🇵🇭" },
  { code: "PK", name: "Pakistan",                        dial: "+92",   flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh",                      dial: "+880",  flag: "🇧🇩" },
  { code: "LK", name: "Sri Lanka",                       dial: "+94",   flag: "🇱🇰" },
  { code: "NP", name: "Nepal",                           dial: "+977",  flag: "🇳🇵" },
  { code: "MM", name: "Myanmar",                         dial: "+95",   flag: "🇲🇲" },
  { code: "KH", name: "Cambodia",                        dial: "+855",  flag: "🇰🇭" },
  { code: "LA", name: "Laos",                            dial: "+856",  flag: "🇱🇦" },
  { code: "TW", name: "Taiwan",                          dial: "+886",  flag: "🇹🇼" },
  { code: "HK", name: "Hong Kong",                       dial: "+852",  flag: "🇭🇰" },
  { code: "MO", name: "Macao",                           dial: "+853",  flag: "🇲🇴" },
  { code: "MN", name: "Mongolia",                        dial: "+976",  flag: "🇲🇳" },
  { code: "KZ", name: "Kazakhstan",                      dial: "+7",    flag: "🇰🇿" },
  { code: "UZ", name: "Uzbekistan",                      dial: "+998",  flag: "🇺🇿" },
  { code: "TM", name: "Turkmenistan",                    dial: "+993",  flag: "🇹🇲" },
  { code: "KG", name: "Kyrgyzstan",                      dial: "+996",  flag: "🇰🇬" },
  { code: "TJ", name: "Tajikistan",                      dial: "+992",  flag: "🇹🇯" },
  { code: "AF", name: "Afghanistan",                     dial: "+93",   flag: "🇦🇫" },
  { code: "AZ", name: "Azerbaijan",                      dial: "+994",  flag: "🇦🇿" },
  { code: "AM", name: "Armenia",                         dial: "+374",  flag: "🇦🇲" },
  { code: "GE", name: "Georgia",                         dial: "+995",  flag: "🇬🇪" },
  { code: "BN", name: "Brunei",                          dial: "+673",  flag: "🇧🇳" },
  { code: "TL", name: "Timor-Leste",                     dial: "+670",  flag: "🇹🇱" },
  { code: "BT", name: "Bhutan",                          dial: "+975",  flag: "🇧🇹" },
  { code: "MV", name: "Maldives",                        dial: "+960",  flag: "🇲🇻" },
  // ── Oceania ───────────────────────────────────────────────────────────────
  { code: "AU", name: "Australia",                       dial: "+61",   flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand",                     dial: "+64",   flag: "🇳🇿" },
  { code: "FJ", name: "Fiji",                            dial: "+679",  flag: "🇫🇯" },
  { code: "PG", name: "Papua New Guinea",                dial: "+675",  flag: "🇵🇬" },
  { code: "SB", name: "Solomon Islands",                 dial: "+677",  flag: "🇸🇧" },
  { code: "VU", name: "Vanuatu",                         dial: "+678",  flag: "🇻🇺" },
  { code: "WS", name: "Samoa",                           dial: "+685",  flag: "🇼🇸" },
  { code: "TO", name: "Tonga",                           dial: "+676",  flag: "🇹🇴" },
  { code: "KI", name: "Kiribati",                        dial: "+686",  flag: "🇰🇮" },
  { code: "FM", name: "Micronesia",                      dial: "+691",  flag: "🇫🇲" },
  { code: "MH", name: "Marshall Islands",                dial: "+692",  flag: "🇲🇭" },
  { code: "PW", name: "Palau",                           dial: "+680",  flag: "🇵🇼" },
  { code: "NR", name: "Nauru",                           dial: "+674",  flag: "🇳🇷" },
  { code: "TV", name: "Tuvalu",                          dial: "+688",  flag: "🇹🇻" },
];

// ── Country picker component ──────────────────────────────────────────────────

function CountryPicker({
  value,
  onChange,
}: {
  value: Country;
  onChange: (c: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase()),
      )
    : COUNTRIES;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className="flex items-center gap-1.5 h-11 px-3 bg-background border border-border rounded-xl hover:bg-muted/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap"
      >
        <span className="text-xl leading-none">{value.flag}</span>
        <span className="text-sm font-medium text-foreground">{value.dial}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-white border border-border rounded-2xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No results</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-violet-50 transition-colors text-left ${
                  c.code === value.code ? "bg-violet-50 text-violet-700 font-medium" : "text-foreground"
                }`}
              >
                <span className="text-lg leading-none w-6 text-center">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-muted-foreground font-mono text-xs">{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step definitions ──────────────────────────────────────────────────────────

type Step = "email" | "email-otp" | "phone" | "phone-otp" | "name" | "password" | "username" | "address" | "dob" | "ticket-code" | "referral-source";

const STEPS: Step[] = ["email", "email-otp", "phone", "phone-otp", "name", "password", "username", "address", "dob", "ticket-code", "referral-source"];

const REFERRAL_OPTIONS: { key: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "noticias",  label: "Noticias",          Icon: Newspaper },
  { key: "amigo",     label: "Por un amigo",       Icon: Users },
  { key: "podcast",   label: "Podcasts",            Icon: Mic2 },
  { key: "google",    label: "Google",              Icon: Globe },
  { key: "instagram", label: "Instagram",           Icon: Instagram },
  { key: "twitter",   label: "Twitter / X",         Icon: Twitter },
  { key: "youtube",   label: "YouTube",             Icon: Youtube },
  { key: "tiktok",    label: "TikTok",              Icon: Music2 },
  { key: "facebook",  label: "Facebook",            Icon: Facebook },
  { key: "chatgpt",   label: "ChatGPT / AI Chat",   Icon: Bot },
  { key: "twitch",    label: "Twitch",              Icon: Twitch },
  { key: "linkedin",  label: "LinkedIn",            Icon: Linkedin },
  { key: "reddit",    label: "Reddit",              Icon: MessageSquare },
  { key: "otro",      label: "Otro",                Icon: HelpCircle },
];

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  const groups = [
    ["email", "email-otp"],
    ["phone", "phone-otp"],
    ["name"],
    ["password"],
    ["username"],
    ["address"],
    ["dob"],
    ["ticket-code"],
    ["referral-source"],
  ] as Step[][];
  return (
    <div className="flex items-center gap-1.5 justify-center mb-8">
      {groups.map((g, i) => {
        const done = g.every((s) => STEPS.indexOf(s) < idx);
        const active = g.includes(current);
        return (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active ? "w-6 bg-primary" : done ? "w-3 bg-primary/40" : "w-3 bg-border"
            }`}
          />
        );
      })}
    </div>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            const arr = value.split("");
            arr[i] = v;
            onChange(arr.join("").slice(0, 6));
            if (v && e.target.nextElementSibling) {
              (e.target.nextElementSibling as HTMLInputElement).focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && e.currentTarget.previousElementSibling) {
              (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            onChange(pasted);
          }}
          className="w-11 h-13 text-center text-lg font-bold border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          style={{ height: "3.25rem" }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function getAffiliateRefFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) return ref;
    const raw = localStorage.getItem("hunch_affiliate_ref");
    if (!raw) return "";
    const { slug, ts } = JSON.parse(raw) as { slug: string; ts: number };
    if (Date.now() - ts > 30 * 24 * 60 * 60 * 1000) { localStorage.removeItem("hunch_affiliate_ref"); return ""; }
    return slug;
  } catch { return ""; }
}

const PAID_PLANS = new Set(["starter", "plus", "pro", "elite"]);
const PENDING_PLAN_LS_KEY = "hunch_pending_plan";
const PENDING_PLAN_TTL = 2 * 60 * 60 * 1000; // 2 hours

function getPendingPlanFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan")?.toLowerCase() ?? "";
    if (plan) {
      // Mirror to localStorage so it survives any navigation
      try { localStorage.setItem(PENDING_PLAN_LS_KEY, JSON.stringify({ planId: plan, ts: Date.now() })); } catch {}
      return plan;
    }
    // Fallback: read from localStorage (set by affiliate-slug handleSubscribe)
    const raw = localStorage.getItem(PENDING_PLAN_LS_KEY);
    if (!raw) return "";
    const { planId, ts } = JSON.parse(raw) as { planId: string; ts: number };
    if (Date.now() - ts > PENDING_PLAN_TTL) { localStorage.removeItem(PENDING_PLAN_LS_KEY); return ""; }
    return planId ?? "";
  } catch { return ""; }
}

export default function Signup() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
  const { t } = useTranslation();

  const affiliateRef = getAffiliateRefFromUrl();
  const [pendingPlan] = useState(() => getPendingPlanFromUrl());

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [country, setCountry] = useState<Country>(COUNTRIES.find(c => c.code === "US")!);
  const [localPhone, setLocalPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrApt, setAddrApt] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostal, setAddrPostal] = useState("");
  const [addrCountry, setAddrCountry] = useState("");
  const [dob, setDob] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoInfo, setPromoInfo] = useState<{ bonusTickets: number; instructions?: string | null; termsAndConditions?: string | null } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [referralSource, setReferralSource] = useState("");

  const fullAddress = [addrStreet, addrApt, addrCity, addrState, addrPostal, addrCountry]
    .filter(Boolean).join(", ");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devHint, setDevHint] = useState("");

  // Full E.164 phone number for sending
  const fullPhone = country.dial + localPhone.replace(/^0+/, "").replace(/\D/g, "");
  // Display version for confirmation screen
  const displayPhone = `${country.flag} ${country.dial} ${localPhone}`;

  // Debounced username availability check
  useEffect(() => {
    const raw = username.trim();
    if (!raw) { setUsernameStatus("idle"); return; }
    const FORMAT_RE = /^[a-zA-Z0-9_.]{3,20}$/;
    if (!FORMAT_RE.test(raw)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/auth/signup/check-username?username=${encodeURIComponent(raw)}`), { credentials: "include" });
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const post = async (path: string, body: object) => {
    const res = await fetch(apiUrl(`/api${path}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;
    setPromoError("");
    setPromoLoading(true);
    try {
      // First try as a promo/ticket code
      const promoRes = await fetch(apiUrl("/api/auth/ticket-codes/redeem"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: promoCode.trim(), context: "registration" }),
      });
      const promoData = await promoRes.json();
      if (promoRes.ok) {
        setPromoApplied(true);
        setPromoInfo({ bonusTickets: promoData.ticketsGranted, instructions: null });
        await refetch();
        return;
      }
      // If code not found in promo codes, try as a referral code
      if (promoData.error === "Code not found.") {
        const refRes = await fetch(apiUrl("/api/auth/referral-codes/redeem"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code: promoCode.trim() }),
        });
        const refData = await refRes.json();
        if (!refRes.ok) { setPromoError(refData.error ?? "Invalid code"); return; }
        setPromoApplied(true);
        setPromoInfo({ bonusTickets: refData.ticketsGranted, instructions: null });
        await refetch();
        return;
      }
      setPromoError(promoData.error ?? "Invalid code");
    } catch {
      setPromoError("Failed to apply code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handle = async () => {
    setError("");
    setDevHint("");
    setLoading(true);
    try {
      if (step === "email") {
        const d = await post("/auth/signup/send-email-otp", { email });
        if (d.devCode) setDevHint(`Dev mode — your code is: ${d.devCode}`);
        setStep("email-otp");
      } else if (step === "email-otp") {
        await post("/auth/signup/verify-email-otp", { code: emailOtp });
        setStep("phone");
      } else if (step === "phone") {
        const d = await post("/auth/signup/send-phone-otp", { phone: fullPhone });
        if (d.devCode) setDevHint(`Dev mode — your code is: ${d.devCode}`);
        setStep("phone-otp");
      } else if (step === "phone-otp") {
        await post("/auth/signup/verify-phone-otp", { code: phoneOtp });
        setStep("name");
      } else if (step === "name") {
        await post("/auth/signup/set-name", { firstName: firstName.trim(), lastName: lastName.trim() });
        setStep("password");
      } else if (step === "password") {
        await post("/auth/signup/set-password", { password });
        setStep("username");
      } else if (step === "username") {
        setStep("address");
      } else if (step === "address") {
        setStep("dob");
      } else if (step === "dob") {
        await post("/auth/signup/complete", { username: username.trim().toLowerCase(), address: fullAddress, dateOfBirth: dob, ...(affiliateRef ? { affiliateRef } : {}) });
        await refetch();
        setStep("ticket-code");
      } else if (step === "ticket-code") {
        setStep("referral-source");
      } else if (step === "referral-source") {
        if (referralSource) {
          fetch(apiUrl("/api/auth/me"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ referralSource }),
          }).catch(() => {});
        }
        if (pendingPlan && PAID_PLANS.has(pendingPlan)) {
          const data = await post("/stripe/subscribe", {
            tierId: pendingPlan,
            referralDiscount: !!affiliateRef,
            returnUrl: window.location.origin,
          }) as { url?: string };
          if (data.url) {
            localStorage.removeItem(PENDING_PLAN_LS_KEY);
            window.location.href = data.url;
          }
        } else {
          setLocation("/");
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const canBack = step !== "email" && step !== "ticket-code" && step !== "referral-source";
  const back = () => {
    setError("");
    setDevHint("");
    const prev: Record<Step, Step | null> = {
      email: null,
      "email-otp": "email",
      phone: "email-otp",
      "phone-otp": "phone",
      name: "phone-otp",
      password: "name",
      username: "password",
      address: "username",
      dob: "address",
      "ticket-code": null,
      "referral-source": null,
    };
    const p = prev[step];
    if (p) setStep(p);
  };

  const isValid = () => {
    if (step === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (step === "email-otp") return emailOtp.length === 6;
    if (step === "phone") return localPhone.replace(/\D/g, "").length >= 6;
    if (step === "phone-otp") return phoneOtp.length === 6;
    if (step === "name") return firstName.trim().length >= 2 && lastName.trim().length >= 2;
    if (step === "password") return password.length >= 8 && password === confirmPassword;
    if (step === "username") return usernameStatus === "available";
    if (step === "address") return addrStreet.trim().length >= 3 && addrCity.trim().length >= 1 && addrCountry.trim().length >= 1;
    if (step === "dob") return dob.length > 0 && agreedTerms && agreedPrivacy;
    if (step === "ticket-code") return true;
    if (step === "referral-source") return true;
    return false;
  };

  const STEP_TITLES: Record<Step, string> = {
    email: t("signup_step_email"),
    "email-otp": t("signup_step_email_otp"),
    phone: t("signup_step_phone"),
    "phone-otp": t("signup_step_phone_otp"),
    name: "Tu nombre",
    password: t("signup_step_password"),
    username: t("signup_step_username"),
    address: t("signup_step_address"),
    dob: t("signup_step_dob"),
    "ticket-code": t("signup_step_ticket_code"),
    "referral-source": "¿Cómo te enteraste?",
  };

  const STEP_SUBS: Record<Step, string> = {
    email: t("signup_sub_email"),
    "email-otp": t("signup_sub_email_otp"),
    phone: t("signup_sub_phone"),
    "phone-otp": t("signup_sub_phone_otp"),
    name: "¿Cómo te llamas?",
    password: t("signup_sub_password"),
    username: t("signup_sub_username"),
    address: t("signup_sub_address"),
    dob: t("signup_sub_dob"),
    "ticket-code": t("signup_sub_ticket_code"),
    "referral-source": "Selecciona la opción que más aplica.",
  };

  const CTALabel: Record<Step, string> = {
    email: t("signup_cta_email"),
    "email-otp": t("signup_cta_email_otp"),
    phone: t("signup_cta_phone"),
    "phone-otp": t("signup_cta_phone_otp"),
    name: t("continue_btn"),
    password: t("signup_cta_password"),
    username: t("continue_btn"),
    address: t("continue_btn"),
    dob: loading ? t("signup_cta_creating") : t("signup_cta_create"),
    "ticket-code": t("continue_btn"),
    "referral-source": (pendingPlan && PAID_PLANS.has(pendingPlan))
      ? "Ir al pago"
      : "Entrar a Hunch",
  };

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 py-12 bg-muted/30 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-sm">
          <div className="text-center mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-sm">
              {step === "email" || step === "email-otp" ? <Mail className="w-5 h-5 text-white" /> :
               step === "phone" || step === "phone-otp" ? <Phone className="w-5 h-5 text-white" /> :
               step === "name" ? <User className="w-5 h-5 text-white" /> :
               step === "password" ? <Lock className="w-5 h-5 text-white" /> :
               step === "username" ? <AtSign className="w-5 h-5 text-white" /> :
               step === "address" ? <MapPin className="w-5 h-5 text-white" /> :
               step === "ticket-code" ? <Ticket className="w-5 h-5 text-white" /> :
               step === "referral-source" ? <Users className="w-5 h-5 text-white" /> :
               <Calendar className="w-5 h-5 text-white" />}
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{STEP_TITLES[step]}</h1>
            <p className="text-muted-foreground text-sm mt-1.5">{STEP_SUBS[step]}</p>
          </div>

          <StepDots current={step} />

          <div className="bg-card border border-border rounded-2xl p-7 card-shadow space-y-5">

            {/* Email */}
            {step === "email" && (
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email_address")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && isValid() && handle()}
                  placeholder="you@example.com"
                  className="rounded-xl h-11 bg-background border-border"
                />
              </div>
            )}

            {/* Email OTP */}
            {step === "email-otp" && (
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  {t("signup_sent_to", { email })}
                </p>
                <OtpInput value={emailOtp} onChange={setEmailOtp} />
                {devHint && (
                  <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {devHint}
                  </p>
                )}
              </div>
            )}

            {/* Phone with country picker */}
            {step === "phone" && (
              <div className="space-y-1.5">
                <Label>{t("acc_phone")}</Label>
                <div className="flex gap-2 items-stretch">
                  <CountryPicker value={country} onChange={(c) => { setCountry(c); setLocalPhone(""); }} />
                  <Input
                    type="tel"
                    autoFocus
                    value={localPhone}
                    onChange={(e) => setLocalPhone(e.target.value.replace(/[^\d\s\-()]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && isValid() && handle()}
                    placeholder="Phone number"
                    className="flex-1 rounded-xl h-11 bg-background border-border"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("signup_phone_hint")}
                </p>
              </div>
            )}

            {/* Phone OTP */}
            {step === "phone-otp" && (
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  {t("signup_sent_to", { email: displayPhone })}
                </p>
                <OtpInput value={phoneOtp} onChange={setPhoneOtp} />
                {devHint && (
                  <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {devHint}
                  </p>
                )}
              </div>
            )}

            {/* Name */}
            {step === "name" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name">Nombre(s)</Label>
                  <Input
                    id="first-name"
                    type="text"
                    autoFocus
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && lastName.trim().length < 2 && (document.getElementById("last-name") as HTMLInputElement)?.focus()}
                    placeholder="Tu nombre"
                    className="rounded-xl h-11 bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name">Apellidos</Label>
                  <Input
                    id="last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && isValid() && handle()}
                    placeholder="Tus apellidos"
                    className="rounded-xl h-11 bg-background border-border"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            {step === "password" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("password")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoFocus
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmPassword && isValid() && handle()}
                      placeholder={t("new_pw_ph")}
                      className="rounded-xl h-11 bg-background border-border pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">{t("signup_confirm_pw")}</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && isValid() && handle()}
                      placeholder={t("signup_confirm_pw_ph")}
                      className={`rounded-xl h-11 bg-background border-border pr-10 ${
                        confirmPassword && confirmPassword !== password
                          ? "border-destructive focus:ring-destructive/30"
                          : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-destructive">{t("pw_no_match")}</p>
                  )}
                </div>
                {/* Strength hint */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => {
                        const strength =
                          password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? 4 :
                          password.length >= 10 && (/[A-Z]/.test(password) || /[0-9]/.test(password)) ? 3 :
                          password.length >= 8 ? 2 : 1;
                        return (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              level <= strength
                                ? strength === 1 ? "bg-destructive"
                                  : strength === 2 ? "bg-amber-400"
                                  : strength === 3 ? "bg-yellow-400"
                                  : "bg-green-500"
                                : "bg-border"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {password.length < 8 ? t("pw_too_short_detail") :
                       password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? t("pw_strong") :
                       password.length >= 10 ? t("pw_good") :
                       t("pw_acceptable")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Username */}
            {step === "username" && (
              <div className="space-y-2">
                <Label htmlFor="username">{t("username_label")}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                  <Input
                    id="username"
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && isValid() && handle()}
                    placeholder="your_username"
                    className="rounded-xl h-11 bg-background border-border pl-7 pr-10"
                    maxLength={20}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                    {usernameStatus === "available" && <Check className="w-4 h-4 text-green-500" />}
                    {(usernameStatus === "taken" || usernameStatus === "invalid") && <X className="w-4 h-4 text-destructive" />}
                  </span>
                </div>
                <p className={`text-xs ${
                  usernameStatus === "available" ? "text-green-600" :
                  usernameStatus === "taken" ? "text-destructive" :
                  usernameStatus === "invalid" ? "text-destructive" :
                  "text-muted-foreground"
                }`}>
                  {usernameStatus === "idle" && t("username_invalid")}
                  {usernameStatus === "checking" && t("checking_avail")}
                  {usernameStatus === "available" && t("username_available", { username: username.trim().toLowerCase() })}
                  {usernameStatus === "taken" && t("username_taken", { username: username.trim().toLowerCase() })}
                  {usernameStatus === "invalid" && t("username_invalid")}
                </p>
              </div>
            )}

            {/* Address */}
            {step === "address" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("signup_street_label")}</Label>
                  <AddressAutocomplete
                    value={addrStreet}
                    onChange={setAddrStreet}
                    onSelect={(p) => {
                      setAddrStreet(p.street);
                      setAddrCity(p.city);
                      setAddrState(p.state);
                      setAddrPostal(p.postal);
                      setAddrCountry(p.country);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addr-apt">{t("apt_label")} <span className="text-muted-foreground font-normal">{t("apt_opt")}</span></Label>
                  <Input
                    id="addr-apt"
                    type="text"
                    autoComplete="off"
                    value={addrApt}
                    onChange={(e) => setAddrApt(e.target.value)}
                    placeholder="Apt 4B, Suite 100..."
                    className="rounded-xl h-11 bg-background border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="addr-city">{t("city_label")}</Label>
                    <Input
                      id="addr-city"
                      type="text"
                      autoComplete="off"
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      placeholder="City"
                      className="rounded-xl h-11 bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="addr-state">{t("state_label")}</Label>
                    <Input
                      id="addr-state"
                      type="text"
                      autoComplete="off"
                      value={addrState}
                      onChange={(e) => setAddrState(e.target.value)}
                      placeholder="State"
                      className="rounded-xl h-11 bg-background border-border"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="addr-postal">{t("zip_label")}</Label>
                    <Input
                      id="addr-postal"
                      type="text"
                      autoComplete="off"
                      value={addrPostal}
                      onChange={(e) => setAddrPostal(e.target.value)}
                      placeholder="00000"
                      className="rounded-xl h-11 bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="addr-country">{t("country_label")}</Label>
                    <Input
                      id="addr-country"
                      type="text"
                      autoComplete="off"
                      value={addrCountry}
                      onChange={(e) => setAddrCountry(e.target.value)}
                      placeholder="Country"
                      className="rounded-xl h-11 bg-background border-border"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("signup_addr_note")}</p>
              </div>
            )}

            {/* Date of birth */}
            {step === "dob" && (
              <div className="space-y-1.5">
                <Label htmlFor="dob">{t("acc_dob")}</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  className="rounded-xl h-11 bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">{t("signup_dob_note")}</p>
                <div className="pt-1 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-border accent-primary cursor-pointer flex-shrink-0"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                      {t("signup_agree_terms_prefix")}{" "}
                      <a href="/terms" target="_blank" className="text-primary underline underline-offset-2 font-medium">
                        {t("terms_of_service")}
                      </a>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreedPrivacy}
                      onChange={(e) => setAgreedPrivacy(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-border accent-primary cursor-pointer flex-shrink-0"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                      {t("signup_agree_privacy_prefix")}{" "}
                      <a href="/privacy" target="_blank" className="text-primary underline underline-offset-2 font-medium">
                        {t("privacy_policy_label")}
                      </a>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Ticket code */}
            {step === "ticket-code" && (
              <div className="space-y-4">
                {pendingPlan && PAID_PLANS.has(pendingPlan) && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-violet-800 capitalize">Plan {pendingPlan}</p>
                      <p className="text-xs text-violet-600">50% OFF primer mes con tu link de afiliado</p>
                    </div>
                    <span className="text-xs font-bold text-violet-700 bg-violet-100 rounded-full px-2.5 py-1">50% OFF</span>
                  </div>
                )}
                {promoApplied && promoInfo ? (
                  <div className="text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-lg">{t("signup_bonus_tickets", { count: promoInfo.bonusTickets })}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{t("signup_bonus_note", { count: 5 + promoInfo.bonusTickets })}</p>
                    </div>
                    {promoInfo.instructions && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-4 py-3 text-left">{promoInfo.instructions}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="promo-code">{t("signup_promo_code_label")}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="promo-code"
                          autoFocus
                          value={promoCode}
                          onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                          onKeyDown={(e) => e.key === "Enter" && promoCode.trim() && applyPromoCode()}
                          placeholder="NBA2026"
                          className="rounded-xl h-11 bg-background border-border font-mono flex-1"
                        />
                        <button
                          type="button"
                          onClick={applyPromoCode}
                          disabled={promoLoading || !promoCode.trim()}
                          className="px-4 h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
                        >
                          {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("signup_apply_btn")}
                        </button>
                      </div>
                    </div>
                    {promoError && (
                      <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">{promoError}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{t("signup_promo_optional")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Referral source */}
            {step === "referral-source" && (
              <div className="grid grid-cols-2 gap-2">
                {REFERRAL_OPTIONS.map(({ key, label, Icon }) => {
                  const selected = referralSource === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setReferralSource(selected ? "" : key)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all text-sm font-medium ${
                        selected
                          ? "border-primary bg-primary/8 text-primary"
                          : "border-border bg-background text-foreground hover:border-muted-foreground/40 hover:bg-muted/40"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                {error}
              </p>
            )}

            <Button
              className="w-full bg-primary text-white font-semibold rounded-xl h-11 shadow-sm hover:bg-primary/90"
              onClick={handle}
              disabled={loading || !isValid()}
            >
              {loading ? t("please_wait") : CTALabel[step]}
            </Button>

            {step === "referral-source" && pendingPlan && PAID_PLANS.has(pendingPlan) && (
              <button
                type="button"
                onClick={() => { localStorage.removeItem(PENDING_PLAN_LS_KEY); setLocation("/"); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Omitir por ahora
              </button>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between">
            {canBack ? (
              <button
                onClick={back}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> {t("back_btn")}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("already_account")}{" "}
                <Link href="/login" className="text-primary hover:underline font-semibold">{t("log_in")}</Link>
              </p>
            )}
            {step === "email-otp" && (
              <button
                className="text-sm text-primary hover:underline font-medium"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const d = await post("/auth/signup/send-email-otp", { email });
                    if (d.devCode) setDevHint(`Dev mode — your code is: ${d.devCode}`);
                    setEmailOtp("");
                  } catch (e: any) { setError(e.message); }
                  finally { setLoading(false); }
                }}
              >
                {t("resend_code")}
              </button>
            )}
            {step === "phone-otp" && (
              <button
                className="text-sm text-primary hover:underline font-medium"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const d = await post("/auth/signup/send-phone-otp", { phone: fullPhone });
                    if (d.devCode) setDevHint(`Dev mode — your code is: ${d.devCode}`);
                    setPhoneOtp("");
                  } catch (e: any) { setError(e.message); }
                  finally { setLoading(false); }
                }}
              >
                {t("resend_code")}
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
