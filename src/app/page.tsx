"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, CirclePlus, CreditCard, LayoutDashboard, Menu, Pencil, Search, Trash2, Wallet, X } from "lucide-react";

type Entry = { id: number; title: string; category: string; amount: number; type: "income" | "expense"; date: string };
type Goal = Record<string, number>;

const seedEntries: Entry[] = [];

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const currentMonthKey = monthKey(new Date());
const monthKeys = Array.from({ length: 6 }, (_, index) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - (5 - index));
  return monthKey(date);
});
const monthLabels = monthKeys.map((key) => new Intl.DateTimeFormat("th-TH", { month: "short" }).format(new Date(`${key}-01`)));
const todayLabel = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
const money = (value: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const dateText = (value: string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(new Date(value));

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>(seedEntries);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [goal, setGoal] = useState<Goal>({});
  const [draftSaving, setDraftSaving] = useState(0);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expense">("all");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [form, setForm] = useState({ title: "", category: "รายได้ประจำ", amount: "", type: "expense" as Entry["type"] });
  const [formError, setFormError] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "entry"; id: number } | { type: "saving"; month: string } | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("pocket-balance-entries");
    if (saved) {
      try { setEntries(JSON.parse(saved)); } catch { window.localStorage.removeItem("pocket-balance-entries"); }
    }
    const syncEntries = (event: StorageEvent) => {
      if (event.key !== "pocket-balance-entries" || !event.newValue) return;
      try { setEntries(JSON.parse(event.newValue)); } catch { /* Ignore invalid external storage data. */ }
    };
    window.addEventListener("storage", syncEntries);
    setLoaded(true);
    return () => window.removeEventListener("storage", syncEntries);
  }, []);
  useEffect(() => {
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="เลือกช่วงเวลา"]');
    if (!select) return;
    select.replaceChildren(...monthKeys.map((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${key}-01`));
      return option;
    }));
    select.value = selectedMonth;
  }, [selectedMonth]);
  useEffect(() => {
    const select = document.querySelector<HTMLSelectElement>('select:not([aria-label="เลือกช่วงเวลา"])');
    const container = select?.parentElement;
    if (!select || !container) return;
    select.style.display = "none";
    container.classList.add("month-picker-container");
    const categoryOrder = ["รายได้ประจำ", "รายได้เสริม", "อาหาร", "เดินทาง", "ที่อยู่อาศัย", "ของใช้"];
    Array.from(select.options)
      .sort((first, second) => categoryOrder.indexOf(first.textContent ?? "") - categoryOrder.indexOf(second.textContent ?? ""))
      .forEach((option) => select.append(option));
    const picker = document.createElement("div");
    picker.className = "custom-month-picker custom-category-picker";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-month-trigger";
    trigger.textContent = select.options[select.selectedIndex]?.textContent ?? "เลือกหมวดหมู่";
    const menu = document.createElement("div");
    menu.className = "custom-month-menu";
    Array.from(select.options).forEach((item) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "custom-month-option";
      option.textContent = item.textContent;
      option.setAttribute("aria-selected", String(item.value === select.value));
      option.addEventListener("click", () => {
        select.value = item.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        menu.classList.remove("is-open");
      });
      menu.append(option);
    });
    trigger.addEventListener("click", () => menu.classList.toggle("is-open"));
    picker.append(trigger, menu);
    container.append(picker);
    return () => {
      picker.remove();
      select.style.display = "";
      container.classList.remove("month-picker-container");
    };
  }, [showForm, form.category]);
  useEffect(() => {
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="เลือกช่วงเวลา"]');
    const container = select?.parentElement;
    if (!select || !container) return;
    select.style.display = "none";
    container.classList.add("month-picker-container");

    const picker = document.createElement("div");
    picker.className = "custom-month-picker";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-month-trigger";
    trigger.setAttribute("aria-label", "เปิดรายการเดือน");
    trigger.setAttribute("aria-expanded", "false");
    const menu = document.createElement("div");
    menu.className = "custom-month-menu";

    monthKeys.forEach((key) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "custom-month-option";
      option.textContent = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${key}-01`));
      option.setAttribute("aria-selected", String(key === selectedMonth));
      option.addEventListener("click", () => {
        select.value = key;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        menu.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      });
      menu.append(option);
    });
    trigger.textContent = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-01`));
    trigger.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });
    picker.append(trigger, menu);
    container.prepend(picker);

    return () => {
      picker.remove();
      select.style.display = "";
      container.classList.remove("month-picker-container");
    };
  }, [selectedMonth]);
  useEffect(() => { if (loaded) window.localStorage.setItem("pocket-balance-entries", JSON.stringify(entries)); }, [entries, loaded]);
  useEffect(() => {
    const savedGoal = window.localStorage.getItem("pocket-balance-goal");
    if (savedGoal) setGoal(JSON.parse(savedGoal));
  }, []);
  useEffect(() => {
    if (loaded) window.localStorage.setItem("pocket-balance-goal", JSON.stringify(goal));
  }, [goal, loaded]);
  useEffect(() => {
    if (!showForm) return;
    const entryForm = document.querySelector<HTMLFormElement>('main form');
    if (entryForm) entryForm.noValidate = true;
  }, [showForm]);
  const filtered = useMemo(() => entries.filter((entry) => {
    const matchesTab = activeTab === "all" || entry.type === activeTab;
    return entry.date.startsWith(selectedMonth) && matchesTab && `${entry.title} ${entry.category}`.toLowerCase().includes(query.toLowerCase());
  }), [entries, activeTab, query, selectedMonth]);
  useEffect(() => {
    const latestSection = Array.from(document.querySelectorAll("main section")).find((section) => section.querySelector("h2")?.textContent === "รายการล่าสุด");
    const rows = latestSection?.querySelectorAll<HTMLElement>(".divide-y > div");
    if (!rows) return;
    const buttons: HTMLButtonElement[] = [];
    rows.forEach((row, index) => {
      const entry = filtered[index];
      if (!entry || row.querySelector("[data-latest-delete]") || row.querySelector("button")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.latestDelete = "true";
      button.setAttribute("aria-label", `ลบ ${entry.title}`);
      button.className = "order-last rounded-md p-1.5 text-[#d9858b] hover:bg-[#fff0f0]";
      button.append(document.createTextNode("ลบ"));
      button.addEventListener("click", () => deleteEntry(entry.id));
      row.append(button);
      buttons.push(button);
    });
    return () => buttons.forEach((button) => button.remove());
  }, [filtered]);
  const selectedEntries = entries.filter((entry) => entry.date.startsWith(selectedMonth));
  const monthData = monthKeys.map((key) => {
    const monthEntries = entries.filter((entry) => entry.date.startsWith(key));
    return {
      income: monthEntries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0),
      expense: monthEntries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0),
    };
  });
  const groupedEntries = Object.entries(filtered.reduce<Record<string, Entry[]>>((groups, entry) => {
    (groups[entry.date.slice(0, 7)] ??= []).push(entry);
    return groups;
  }, {}));
  const savingHistory = monthKeys.map((key) => ({ month: key, amount: goal[key] || 0 })).filter((item) => item.amount > 0).reverse();
  const income = selectedEntries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const expense = selectedEntries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
  const balance = income - expense;
  const selectedMonthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-01`));

  function goToSection(section: "overview" | "transactions" | "savings") {
    setShowDrawer(false);
    if (section === "transactions") setActiveTab("all");
    if (section === "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const sections = Array.from(document.querySelectorAll("main section"));
    const target = section === "savings"
      ? sections.find((item) => item.textContent?.includes("ออมเดือนนี้"))
      : sections.find((item) => item.querySelector("h2")?.textContent === "รายการล่าสุด");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addEntry(event: React.FormEvent) {
    event.preventDefault();
    const title = form.title.trim();
    const amount = Number(form.amount);
    if (!title && !form.amount) {
      setAlertMessage("กรุณากรอกชื่อรายการและจำนวนเงิน");
      return;
    }
    if (!title) {
      setAlertMessage("กรุณากรอกชื่อรายการ");
      return;
    }
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) {
      setAlertMessage("กรุณากรอกจำนวนเงินให้ถูกต้อง โดยจำนวนเงินต้องมากกว่า 0");
      return;
    }
    const entry = { id: editingId ?? Date.now(), title, category: form.category, amount, type: form.type, date: editingId ? entries.find((item) => item.id === editingId)?.date ?? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10) };
    setEntries((items) => editingId ? items.map((item) => item.id === editingId ? entry : item) : [entry, ...items]);
    setForm({ title: "", category: "รายได้ประจำ", amount: "", type: "expense" });
    setFormError("");
    setEditingId(null);
    setShowForm(false);
  }

  function editEntry(entry: Entry) {
    setEditingId(entry.id);
    setForm({ title: entry.title, category: entry.category, amount: String(entry.amount), type: entry.type });
    setFormError("");
    setShowForm(true);
  }

  function deleteEntry(id: number) {
    setDeleteTarget({ type: "entry", id });
  }

  function deleteSaving(month: string) {
    setDeleteTarget({ type: "saving", month });
  }

  function removeEntry(id: number) {
    setEntries((items) => items.filter((item) => item.id !== id));
  }

  function removeSaving(month: string) {
    setGoal((items) => {
      const nextGoal = { ...items };
      delete nextGoal[month];
      return nextGoal;
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "entry") removeEntry(deleteTarget.id);
    else removeSaving(deleteTarget.month);
    setDeleteTarget(null);
  }

  function openAddForm() {
    setEditingId(null);
    setForm({ title: "", category: "รายได้ประจำ", amount: "", type: "expense" });
    setFormError("");
    setShowForm(true);
  }

  function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    if (draftSaving < 0) return;
    setGoal({ ...goal, [selectedMonth]: draftSaving });
    setShowGoalForm(false);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf4]">
      {alertMessage && <div className="fixed inset-0 z-50 grid place-items-center bg-[#23352d]/35 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="alert-title"><div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto grid size-14 place-items-center rounded-full bg-[#fff0d9] text-[#d88938]"><span className="text-2xl font-bold">!</span></div><h2 id="alert-title" className="mt-4 text-lg font-semibold text-[#29322d]">กรอกข้อมูลไม่ครบ</h2><p className="mt-2 text-sm leading-6 text-[#819087]">{alertMessage}</p><button type="button" autoFocus onClick={() => setAlertMessage("")} className="mt-6 w-full rounded-xl bg-[#527c67] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#315947]">รับทราบ</button></div></div>}
      {showDrawer && <div className="fixed inset-0 z-20 bg-[#23352d]/30 lg:hidden" onClick={() => setShowDrawer(false)}><aside className="h-full w-72 bg-[#f5f8f0] px-6 py-8 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div className="flex items-center gap-3 text-[#315947]"><span className="grid size-10 place-items-center rounded-xl bg-[#527c67] text-white"><Wallet size={21} /></span><span className="text-xl font-semibold tracking-tight">Pocket<span className="text-[#e99a9d]">Balance</span></span></div><button type="button" aria-label="ปิดเมนู" onClick={() => setShowDrawer(false)} className="rounded-lg p-2 text-[#819087] hover:bg-[#e8f1e8]"><X size={19} /></button></div><nav className="mt-16 space-y-2"><button type="button" onClick={() => goToSection("overview")} className="flex w-full items-center gap-3 rounded-xl bg-[#dfece1] px-4 py-3 text-left text-sm font-semibold text-[#315947]"><LayoutDashboard size={18} /> ภาพรวม</button><button type="button" onClick={() => goToSection("transactions")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#819087] transition hover:bg-[#e8f1e8] hover:text-[#315947]"><CreditCard size={18} /> รายการทั้งหมด</button><button type="button" onClick={() => goToSection("savings")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#819087] transition hover:bg-[#e8f1e8] hover:text-[#315947]"><Wallet size={18} /> บันทึกการออมรายเดือน</button></nav></aside></div>}
      {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-[#23352d]/35 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto grid size-14 place-items-center rounded-full bg-[#fff0d9] text-[#d88938]"><Trash2 size={25} /></div><h2 id="delete-title" className="mt-4 text-lg font-semibold text-[#29322d]">ยืนยันการลบ</h2><p className="mt-2 text-sm leading-6 text-[#819087]">ข้อมูลที่ลบแล้วจะไม่สามารถเรียกคืนได้</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl bg-[#f3f5f0] px-4 py-2.5 text-sm font-semibold text-[#66756c] hover:bg-[#e8eee6]">ยกเลิก</button><button type="button" autoFocus onClick={confirmDelete} className="flex-1 rounded-xl bg-[#d9858b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#bf6d75]">ลบข้อมูล</button></div></div></div>}
      <div className="mx-auto flex max-w-360">
        <aside className="hidden min-h-screen w-59.5 shrink-0 border-r border-[#e7e8df] bg-[#f5f8f0] px-6 py-8 lg:block">
          <div className="flex items-center gap-3 text-[#315947]"><span className="grid size-10 place-items-center rounded-xl bg-[#527c67] text-white"><Wallet size={21} /></span><span className="text-xl font-semibold tracking-tight">Pocket<span className="text-[#e99a9d]">Balance</span></span></div>
          <nav className="mt-16 space-y-2"><button type="button" onClick={() => goToSection("overview")} className="flex w-full items-center gap-3 rounded-xl bg-[#dfece1] px-4 py-3 text-left text-sm font-semibold text-[#315947]"><LayoutDashboard size={18} /> ภาพรวม</button><button type="button" onClick={() => goToSection("transactions")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#819087] transition hover:bg-[#e8f1e8] hover:text-[#315947]"><CreditCard size={18} /> รายการทั้งหมด</button><button type="button" onClick={() => goToSection("savings")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#819087] transition hover:bg-[#e8f1e8] hover:text-[#315947]"><Wallet size={18} /> บันทึกการออมรายเดือน</button></nav>
          <div className="mt-auto pt-107.5 text-xs leading-6 text-[#9ca89f]">จัดการเงินของคุณ<br />ให้เป็นเรื่องง่ายในทุกวัน</div>
        </aside>
        <section className="min-w-0 flex-1 px-5 py-5 sm:px-8 lg:px-12 lg:py-8">
          <header className="flex items-center justify-between"><div className="flex items-center gap-3 lg:hidden"><button type="button" aria-label="เปิดเมนู" onClick={() => setShowDrawer(true)} className="rounded-lg p-1 text-[#527c67] hover:bg-[#e8f1e8]"><Menu size={21} /></button><span className="font-semibold text-[#315947]">Pocket<span className="text-[#e99a9d]">Balance</span></span></div><div className="hidden lg:block"><p className="text-sm text-[#9ca89f]">{todayLabel}</p></div><button onClick={openAddForm} className="flex items-center gap-2 rounded-xl bg-[#e99a9d] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(233,154,157,.22)] transition hover:bg-[#d9858b]"><CirclePlus size={18} /> เพิ่มรายการ</button></header>
          <div className="mt-8 grid gap-4 md:grid-cols-3"><SummaryCard label="ยอดคงเหลือ" value={balance} icon={<Wallet size={20} />} tone="green" note={`สรุปของ${selectedMonthLabel}`} /><SummaryCard label="รายรับทั้งหมด" value={income} icon={<ArrowDownLeft size={20} />} tone="pink" note={`รายรับ${selectedMonthLabel}`} /><SummaryCard label="รายจ่ายทั้งหมด" value={expense} icon={<ArrowUpRight size={20} />} tone="cream" note={`รายจ่าย${selectedMonthLabel}`} /></div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
            <section className="animate-rise rounded-2xl border border-[#e9e9df] bg-white p-5 shadow-[0_8px_30px_rgba(65,80,62,.04)] sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-medium uppercase tracking-[.14em] text-[#9ca89f]">ภาพรวมเงิน</p><h2 className="mt-1 text-lg font-semibold">รายรับ - รายจ่าย</h2></div><div className="flex items-center gap-2 rounded-lg border border-[#e7e8df] px-3 py-2 text-xs text-[#66756c]"><select aria-label="เลือกช่วงเวลา" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent outline-none"><option value="2025-01">มกราคม 2568</option><option value="2025-02">กุมภาพันธ์ 2568</option><option value="2025-03">มีนาคม 2568</option><option value="2025-04">เมษายน 2568</option><option value="2025-05">พฤษภาคม 2568</option><option value="2025-06">มิถุนายน 2568</option></select><ChevronDown size={14} /></div></div><div className="mt-7 flex items-center gap-5 text-xs text-[#819087]"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-[#527c67]" />รายรับ</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-[#e99a9d]" />รายจ่าย</span><span className="ml-auto text-[#9ca89f]">ย้อนหลัง 6 เดือน</span></div><div className="mt-5 flex h-52 items-end gap-3 border-b border-dashed border-[#e8e9e2] px-1 sm:gap-6">{monthData.map((item, index) => <button type="button" onClick={() => setSelectedMonth(`2025-${String(index + 1).padStart(2, "0")}`)} className={`flex h-full flex-1 items-end justify-center gap-1.5 rounded-t-lg px-1 ${selectedMonth === `2025-${String(index + 1).padStart(2, "0")}` ? "bg-[#f7faf4]" : ""}`} key={monthLabels[index]} aria-label={`ดูข้อมูลเดือน${monthLabels[index]}`}><div title={`รายรับ ${money(item.income)} บาท`} className="w-3 rounded-t-md bg-[#72a087] transition-all hover:bg-[#527c67] sm:w-5" style={{ height: `${item.income / 50000 * 100}%` }} /><div title={`รายจ่าย ${money(item.expense)} บาท`} className="w-3 rounded-t-md bg-[#efb4b5] transition-all hover:bg-[#e99a9d] sm:w-5" style={{ height: `${item.expense / 50000 * 100}%` }} /></button>)}</div><div className="mt-3 flex justify-between px-1 text-[11px] text-[#9ca89f]">{monthLabels.map((label) => <span key={label}>{label}</span>)}</div></section>
          </div>
          <section className="animate-rise delay-2 mt-6 rounded-2xl border border-[#e9e9df] bg-white p-5 shadow-[0_8px_30px_rgba(65,80,62,.04)] sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold">รายการล่าสุด</h2><p className="mt-1 text-xs text-[#9ca89f]">รายการเคลื่อนไหวล่าสุดของคุณ</p></div><div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-lg border border-[#e7e8df] px-3 py-2 text-xs text-[#9ca89f]"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหารายการ" className="w-24 bg-transparent outline-none placeholder:text-[#aab3ac] sm:w-32" /></div><div className="flex rounded-lg bg-[#f4f6f1] p-1 text-xs"><button onClick={() => setActiveTab("all")} className={`rounded-md px-3 py-1.5 ${activeTab === "all" ? "bg-white font-semibold text-[#315947] shadow-sm" : "text-[#9ca89f]"}`}>ทั้งหมด</button><button onClick={() => setActiveTab("income")} className={`rounded-md px-3 py-1.5 ${activeTab === "income" ? "bg-white font-semibold text-[#315947] shadow-sm" : "text-[#9ca89f]"}`}>รับ</button><button onClick={() => setActiveTab("expense")} className={`rounded-md px-3 py-1.5 ${activeTab === "expense" ? "bg-white font-semibold text-[#315947] shadow-sm" : "text-[#9ca89f]"}`}>จ่าย</button></div></div></div><div className="mt-5 divide-y divide-[#f0f1eb]">{filtered.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${entry.type === "income" ? "bg-[#e5f1e6] text-[#527c67]" : "bg-[#fff0f0] text-[#d9858b]"}`}>{entry.type === "income" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{entry.title}</p><p className="mt-0.5 text-[11px] text-[#9ca89f]">{entry.category} · {dateText(entry.date)}</p></div></div><p className={`shrink-0 text-sm font-semibold ${entry.type === "income" ? "text-[#527c67]" : "text-[#29322d]"}`}>{entry.type === "income" ? "+" : "-"} ฿{money(entry.amount)}</p></div>)}{filtered.length === 0 && <p className="py-8 text-center text-sm text-[#9ca89f]">ไม่พบรายการที่ค้นหา</p>}</div></section>
          <p className="py-8 text-center text-xs text-[#aab3ac]">ข้อมูลของคุณเก็บไว้บนอุปกรณ์นี้อย่างปลอดภัย · อัปเดตล่าสุดเมื่อสักครู่</p>
        </section>
      </div>
      {showForm && <div className="fixed inset-0 z-10 grid place-items-center bg-[#23352d]/30 p-4 backdrop-blur-sm"><form onSubmit={addEntry} className="w-full max-w-md rounded-2xl bg-[#fffaf4] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">เพิ่มรายการใหม่</h2><p className="mt-1 text-xs text-[#819087]">บันทึกทุกความเคลื่อนไหวของคุณ</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-[#819087] hover:bg-[#f2eee7]"><X size={19} /></button></div><div className="mt-6 flex gap-2"><button type="button" onClick={() => setForm({ ...form, type: "expense" })} className={`flex-1 rounded-lg py-2.5 text-sm font-medium ${form.type === "expense" ? "bg-[#e99a9d] text-white" : "bg-[#f4ebe8] text-[#bb656e]"}`}>รายจ่าย</button><button type="button" onClick={() => setForm({ ...form, type: "income" })} className={`flex-1 rounded-lg py-2.5 text-sm font-medium ${form.type === "income" ? "bg-[#527c67] text-white" : "bg-[#e8f0e7] text-[#527c67]"}`}>รายรับ</button></div><label className="mt-5 block text-xs font-medium text-[#66756c]">ชื่อรายการ<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น เงินเดือน, ค่าอาหาร" className="mt-2 w-full rounded-lg border border-[#e2e4da] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#527c67]" /></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-medium text-[#66756c]">หมวดหมู่<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-2 w-full rounded-lg border border-[#e2e4da] bg-white px-3 py-2.5 text-sm outline-none"><option>อาหาร</option><option>เดินทาง</option><option>ที่อยู่อาศัย</option><option>ของใช้</option><option>รายได้ประจำ</option><option>รายได้เสริม</option></select></label><label className="text-xs font-medium text-[#66756c]">จำนวนเงิน<input required min="0" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="mt-2 w-full rounded-lg border border-[#e2e4da] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#527c67]" /></label></div><button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#315947] py-3 text-sm font-semibold text-white transition hover:bg-[#527c67]"><Pencil size={16} /> บันทึกรายการ</button></form></div>}
      <section className="mx-auto w-full max-w-360 space-y-6 px-5 pb-8 sm:px-8 lg:px-12">
        <div className="grid gap-6 xl:grid-cols-[1fr_1.45fr]">
          <section className="rounded-2xl border border-[#e9e9df] bg-white p-6 text-[#29322d] shadow-[0_8px_30px_rgba(65,80,62,.04)]">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs tracking-[.14em] text-[#819087]">การออมรายเดือน</p><h2 className="mt-1 text-lg font-semibold">{selectedMonthLabel}</h2></div><button type="button" onClick={() => { setDraftSaving(goal[selectedMonth] || 0); setShowGoalForm((value) => !value); }} className="rounded-lg bg-[#527c67] p-2 text-white hover:bg-[#315947]"><Pencil size={17} /></button></div>
            <div className="mt-8"><p className="text-xs text-[#819087]">ออมเดือนนี้</p><p className="mt-1 text-3xl font-semibold tracking-tight text-[#315947]">฿{money(goal[selectedMonth] || 0)}</p></div>
            {showGoalForm && <form onSubmit={saveGoal} className="mt-6 space-y-3 border-t border-[#e7e8df] pt-5"><label className="block text-xs text-[#66756c]">จำนวนเงินที่ออมในเดือนนี้<input required min="0" type="number" value={draftSaving || ""} onChange={(event) => setDraftSaving(Number(event.target.value))} placeholder="0.00" className="mt-2 w-full rounded-lg border border-[#e2e4da] bg-[#fffaf4] px-3 py-2 text-sm outline-none focus:border-[#527c67]" /></label><div className="flex gap-2"><button type="submit" className="flex-1 rounded-lg bg-[#527c67] py-2 text-sm font-semibold text-white hover:bg-[#315947]">ยืนยัน</button><button type="button" onClick={() => setShowGoalForm(false)} className="flex-1 rounded-lg bg-[#e99a9d] py-2 text-sm font-semibold text-white hover:bg-[#d9858b]">ยกเลิก</button></div></form>}
          </section>
          <section className="rounded-2xl border border-[#e9e9df] bg-white p-6 shadow-[0_8px_30px_rgba(65,80,62,.04)]"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">รายการทั้งหมดแยกตามเดือน</h2><p className="mt-1 text-xs text-[#9ca89f]">แก้ไขหรือลบรายการได้จากที่นี่</p></div><button type="button" onClick={() => { setEditingId(null); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-[#e99a9d] px-3 py-2 text-xs font-semibold text-white"><CirclePlus size={15} /> เพิ่มรายการ</button></div><div className="mt-5 space-y-5">{groupedEntries.map(([month, items]) => <div key={month}><h3 className="mb-2 text-xs font-semibold text-[#527c67]">{new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${month}-01`))}</h3><div className="divide-y divide-[#f0f1eb]">{items.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{entry.title}</p><p className="text-[11px] text-[#9ca89f]">{entry.category} · {dateText(entry.date)}</p></div><div className="flex items-center gap-2"><span className={`text-sm font-semibold ${entry.type === "income" ? "text-[#527c67]" : "text-[#29322d]"}`}>{entry.type === "income" ? "+" : "-"} ฿{money(entry.amount)}</span><button type="button" aria-label={`แก้ไข ${entry.title}`} onClick={() => editEntry(entry)} className="rounded-md p-1.5 text-[#819087] hover:bg-[#e8f1e8] hover:text-[#315947]"><Pencil size={15} /></button><button type="button" aria-label={`ลบ ${entry.title}`} onClick={() => deleteEntry(entry.id)} className="rounded-md p-1.5 text-[#d9858b] hover:bg-[#fff0f0]"><Trash2 size={15} /></button></div></div>)}</div></div>)}{groupedEntries.length === 0 && <p className="py-8 text-center text-sm text-[#9ca89f]">ยังไม่มีรายการ</p>}</div></section>
        </div>
      </section>
      <section className="mx-auto w-full max-w-360 px-5 pb-10 sm:px-8 lg:px-12">
        <div className="rounded-2xl border border-[#e9e9df] bg-white p-6 shadow-[0_8px_30px_rgba(65,80,62,.04)]"><div className="flex items-center justify-between"><div><p className="text-xs tracking-[.14em] text-[#9ca89f]">เป้าหมายการออม</p><h2 className="mt-1 text-lg font-semibold">ประวัติการออมรายเดือน</h2></div><span className="rounded-lg bg-[#e5f1e6] p-2 text-[#527c67]"><Wallet size={18} /></span></div><div className="mt-5 divide-y divide-[#f0f1eb]">{savingHistory.map((item) => <div key={item.month} className="flex items-center justify-between gap-3 py-3"><div><span className="text-sm text-[#66756c]">{new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${item.month}-01`))}</span><p className="mt-1 text-sm font-semibold text-[#527c67]">ออม ฿{money(item.amount)}</p></div><button type="button" aria-label={`ลบข้อมูลการออม ${item.month}`} onClick={() => deleteSaving(item.month)} className="rounded-md p-1.5 text-[#d9858b] hover:bg-[#fff0f0]"><Trash2 size={15} /></button></div>)}{savingHistory.length === 0 && <p className="py-6 text-center text-sm text-[#9ca89f]">ยังไม่มีรายการออมรายเดือน</p>}</div></div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value, icon, tone, note }: { label: string; value: number; icon: React.ReactNode; tone: "green" | "pink" | "cream"; note: string }) {
  const colors = { green: "bg-[#e5f1e6] text-[#527c67]", pink: "bg-[#fff0f0] text-[#d9858b]", cream: "bg-[#f8eee1] text-[#b67d4e] " };
  return <div className="animate-rise rounded-2xl border border-[#e9e9df] bg-white p-5 shadow-[0_8px_30px_rgba(65,80,62,.04)]"><div className="flex items-center justify-between"><p className="text-xs text-[#819087]">{label}</p><span className={`grid size-9 place-items-center rounded-xl ${colors[tone]}`}>{icon}</span></div><p className="mt-5 font-['DM_Sans'] text-2xl font-semibold tracking-tight">฿{money(value)}</p><p className="mt-2 text-[11px] text-[#9ca89f]">{note}</p></div>;
}
