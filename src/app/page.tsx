"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, CirclePlus, CreditCard, LayoutDashboard, Menu, Pencil, Search, Trash2, Wallet, X, Landmark, ArrowRightLeft } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

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
  const [alertMessage, setAlertMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "entry"; id: number } | { type: "saving"; month: string } | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (isSupabaseConfigured && supabase) {
        const [{ data: remoteEntries, error: entriesError }, { data: remoteSavings, error: savingsError }] = await Promise.all([
          supabase.from("entries").select("id, title, category, amount, type, entry_date").order("created_at", { ascending: false }),
          supabase.from("savings").select("month_key, amount"),
        ]);
        if (!active) return;
        const hasConnectionError = [entriesError, savingsError].some((error) => Boolean(error?.message));
        if (hasConnectionError) {
          const error = entriesError?.message || savingsError?.message;
          console.error("Supabase load failed", error);
          setAlertMessage(`เชื่อมต่อ Supabase ไม่สำเร็จ: ${error}`);
        }
        if (remoteEntries?.length) {
          setEntries(remoteEntries.map((entry) => ({ id: Number(entry.id), title: entry.title, category: entry.category, amount: Number(entry.amount), type: entry.type as Entry["type"], date: entry.entry_date })));
        } else {
          const localEntries = window.localStorage.getItem("pocket-balance-entries");
          if (localEntries) {
            try { setEntries(JSON.parse(localEntries)); } catch { window.localStorage.removeItem("pocket-balance-entries"); }
          }
        }
        if (remoteSavings?.length) {
          setGoal(Object.fromEntries(remoteSavings.map((item) => [item.month_key, Number(item.amount)])));
        } else {
          const localGoal = window.localStorage.getItem("pocket-balance-goal");
          if (localGoal) {
            try { setGoal(JSON.parse(localGoal)); } catch { window.localStorage.removeItem("pocket-balance-goal"); }
          }
        }
      } else {
        const saved = window.localStorage.getItem("pocket-balance-entries");
        if (saved) {
          try { setEntries(JSON.parse(saved)); } catch { window.localStorage.removeItem("pocket-balance-entries"); }
        }
        const savedGoal = window.localStorage.getItem("pocket-balance-goal");
        if (savedGoal) {
          try { setGoal(JSON.parse(savedGoal)); } catch { window.localStorage.removeItem("pocket-balance-goal"); }
        }
      }
      setLoaded(true);
    };
    loadData();
    if (!isSupabaseConfigured || !supabase) return () => { active = false; };
    const client = supabase;
    const channel = client.channel("pocket-balance-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "savings" }, loadData)
      .subscribe();
    return () => { active = false; void client.removeChannel(channel); };
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
    // อัปเดต Class เพิ่ม w-full h-full
    picker.className = "custom-month-picker custom-category-picker relative w-full h-full";
    
    const trigger = document.createElement("button");
    trigger.type = "button";
    // อัปเดต Class ปรับแต่งขนาดและเส้นขอบให้เหมือน Input ฝั่งขวา
    trigger.className = "custom-month-trigger flex h-full w-full items-center justify-between rounded-xl border border-[#e7eeeb] bg-white px-4 text-sm outline-none transition-colors focus:border-[#80A867] focus:ring-1 focus:ring-[#80A867]";
    // อัปเดต innerHTML เพื่อใส่ไอคอนลูกศร
    trigger.innerHTML = `<span>${select.options[select.selectedIndex]?.textContent ?? "เลือกหมวดหมู่"}</span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#819087]"><path d="m6 9 6 6 6-6"/></svg>`;
    
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

  useEffect(() => {
    if (!loaded || isSupabaseConfigured || !window) return;
    window.localStorage.setItem("pocket-balance-entries", JSON.stringify(entries));
  }, [entries, loaded]);
  useEffect(() => {
    if (!loaded || isSupabaseConfigured || !window) return;
    window.localStorage.setItem("pocket-balance-goal", JSON.stringify(goal));
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
      
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.dataset.latestDelete = "true";
      editButton.setAttribute("aria-label", `แก้ไข ${entry.title}`);
      editButton.className = "order-last rounded-md p-1.5 text-[#819087] hover:text-[#5D7F4A] hover:bg-[#EEF5E8] transition-colors ml-2";
      editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
      editButton.addEventListener("click", () => editEntry(entry));
      
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.dataset.latestDelete = "true";
      deleteButton.setAttribute("aria-label", `ลบ ${entry.title}`);
      deleteButton.className = "order-last rounded-md p-1.5 text-[#B86C95] hover:text-[#DE98BC] hover:bg-[#FBEAF2] transition-colors";
      deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
      deleteButton.addEventListener("click", () => deleteEntry(entry.id));
      
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "flex gap-1";
      buttonContainer.append(editButton, deleteButton);
      
      row.append(buttonContainer);
      buttons.push(editButton, deleteButton);
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
  
  const savingHistory = monthKeys.map((key) => ({ month: key, amount: goal[key] || 0 })).filter((item) => item.amount > 0).reverse().slice(0, 4);
  const income = selectedEntries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const expense = selectedEntries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
  const balance = income - expense;
  const selectedMonthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-01`));
  const currentMonthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${currentMonthKey}-01`));

  function goToSection(section: "overview" | "transactions" | "savings") {
    setShowDrawer(false);
    if (section === "transactions") setActiveTab("all");
    if (section === "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const sections = Array.from(document.querySelectorAll("main section"));
    const target = section === "savings"
      ? sections.find((item) => item.textContent?.includes("เป้าหมายการออม"))
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
    void saveRemoteEntry(entry);
    setForm({ title: "", category: "รายได้ประจำ", amount: "", type: "expense" });
    setEditingId(null);
    setShowForm(false);
  }

  async function saveRemoteEntry(entry: Entry) {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from("entries").upsert({
      id: entry.id,
      title: entry.title,
      category: entry.category,
      amount: entry.amount,
      type: entry.type,
      entry_date: entry.date,
    }, { onConflict: "id" });
    if (error) {
      console.error("Supabase entry save failed", { message: error.message, details: error.details, hint: error.hint, code: error.code });
      setAlertMessage("บันทึกรายการลง Supabase ไม่สำเร็จ กรุณาตรวจสอบตาราง entries");
    }
  }

  function editEntry(entry: Entry) {
    setEditingId(entry.id);
    setForm({ title: entry.title, category: entry.category, amount: String(entry.amount), type: entry.type });
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
    if (isSupabaseConfigured && supabase) void supabase.from("entries").delete().eq("id", id).then(({ error }) => {
      if (error) console.error("Supabase entry delete failed", error);
    });
  }

  function removeSaving(month: string) {
    setGoal((items) => {
      const nextGoal = { ...items };
      delete nextGoal[month];
      return nextGoal;
    });
    if (isSupabaseConfigured && supabase) void supabase.from("savings").delete().eq("month_key", month).then(({ error }) => {
      if (error) console.error("Supabase saving delete failed", error);
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
    setShowForm(true);
  }

  function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    if (draftSaving < 0) return;
    setGoal({ ...goal, [currentMonthKey]: draftSaving });
    void saveRemoteSaving(currentMonthKey, draftSaving);
    setShowGoalForm(false);
  }

  async function saveRemoteSaving(month_key: string, amount: number) {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from("savings").upsert({ month_key, amount }, { onConflict: "month_key" });
    if (error) {
      console.error("Supabase savings save failed", error.message);
      setAlertMessage(`บันทึกข้อมูลการออมไม่สำเร็จ: ${error.message}`);
    }
  }

  return (
    <main className="min-h-screen bg-[#fcfdfc] text-[#23343b] font-['Prompt']">
      {!loaded && <LoadingSkeleton />}
      
      {/* Alert Modal - Z-INDEX 9999 FOR FIXING */}
      {alertMessage && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-[#23343b]/40 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-xl border border-[#e7eeeb]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FBEAF2] text-[#B86C95]">
              <span className="text-2xl font-bold font-sans-en">!</span>
            </div>
            <h2 id="alert-title" className="mt-4 text-lg font-semibold text-[#23343b]">เกิดข้อผิดพลาด</h2>
            <p className="mt-2 text-sm leading-6 text-[#819087]">{alertMessage}</p>
            <button type="button" autoFocus onClick={() => setAlertMessage("")} className="mt-6 w-full rounded-xl bg-[#DE98BC] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#B86C95]">รับทราบ</button>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal - Z-INDEX 9999 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-[#23343b]/40 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-xl border border-[#e7eeeb]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FBEAF2] text-[#B86C95]">
              <Trash2 size={24} />
            </div>
            <h2 id="delete-title" className="mt-4 text-lg font-semibold text-[#23343b]">ยืนยันการลบ</h2>
            <p className="mt-2 text-sm leading-6 text-[#819087]">ข้อมูลที่ลบแล้วจะไม่สามารถเรียกคืนได้</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl bg-[#f5f8f7] px-4 py-2.5 text-sm font-semibold text-[#819087] hover:bg-[#e7eeeb] transition-colors">ยกเลิก</button>
              <button type="button" autoFocus onClick={confirmDelete} className="flex-1 rounded-xl bg-[#DE98BC] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B86C95] transition-colors">ลบข้อมูล</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Transaction Form Modal - Z-INDEX 9990 */}
      {showForm && (
        <div className="fixed inset-0 z-9990 flex items-center justify-center bg-[#23343b]/40 p-4 backdrop-blur-sm">
          <form onSubmit={addEntry} className="w-full max-w-md rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-[#e7eeeb]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#23343b]">{editingId ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</h2>
                <p className="mt-1 text-sm text-[#819087]">บันทึกข้อมูลการเงินของคุณ</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full p-2 text-[#819087] hover:bg-[#f5f8f7] transition-colors"><X size={20} /></button>
            </div>
            
            <div className="mt-8 flex gap-2 rounded-xl bg-[#f5f8f7] p-1">
              <button type="button" onClick={() => setForm({ ...form, type: "expense" })} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${form.type === "expense" ? "bg-white text-[#DE98BC] shadow-sm" : "text-[#819087] hover:text-[#23343b]"}`}>รายจ่าย</button>
              <button type="button" onClick={() => setForm({ ...form, type: "income" })} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${form.type === "income" ? "bg-white text-[#80A867] shadow-sm" : "text-[#819087] hover:text-[#23343b]"}`}>รายรับ</button>
            </div>

            <label className="mt-6 block text-sm font-medium text-[#23343b]">
              ชื่อรายการ
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น เงินเดือน, ค่าอาหาร" className="mt-2 w-full rounded-xl border border-[#e7eeeb] bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[#80A867] focus:ring-1 focus:ring-[#80A867]" />
            </label>


            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[#23343b]">หมวดหมู่</label>
                <div className="relative w-full h-11.5">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-full w-full rounded-xl border border-[#e7eeeb] bg-white px-4 text-sm outline-none transition-colors focus:border-[#80A867] focus:ring-1 focus:ring-[#80A867]">
                    <option>อาหาร</option><option>เดินทาง</option><option>ที่อยู่อาศัย</option><option>ของใช้</option><option>รายได้ประจำ</option><option>รายได้เสริม</option>
                  </select>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[#23343b]">จำนวนเงิน</label>
                <div className="relative w-full h-11.5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#819087] font-sans-en">฿</span>
                  <input required min="0" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="h-full w-full rounded-xl border border-[#e7eeeb] bg-white pl-8 pr-4 text-sm font-sans-en outline-none transition-colors focus:border-[#80A867] focus:ring-1 focus:ring-[#80A867]" />
                </div>
              </div>
            </div>
            
            <button className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#80A867] py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5D7F4A] focus:ring-4 focus:ring-[#EEF5E8]">
              <Pencil size={18} /> {editingId ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}
            </button>
          </form>
        </div>
      )}

      {/* Mobile Drawer - Z-INDEX 9980 */}
      {showDrawer && (
        <div className="fixed inset-0 z-9980 bg-[#23343b]/40 lg:hidden backdrop-blur-sm" onClick={() => setShowDrawer(false)}>
          <aside className="h-full w-72 bg-white px-6 py-8 shadow-2xl border-r border-[#e7eeeb]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[#23343b]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#80A867] text-white"><Landmark size={20} /></span>
                <span className="text-xl font-bold tracking-tight font-sans-en">POCKET<span className="text-[#DE98BC] font-light">BALANCE</span></span>
              </div>
              <button type="button" aria-label="ปิดเมนู" onClick={() => setShowDrawer(false)} className="rounded-lg p-2 text-[#819087] hover:bg-[#f5f8f7]"><X size={19} /></button>
            </div>
            <nav className="mt-12 space-y-2">
              <button type="button" onClick={() => goToSection("overview")} className="flex w-full items-center gap-3 rounded-xl bg-[#EEF5E8] px-4 py-3 text-left text-sm font-semibold text-[#5D7F4A]"><LayoutDashboard size={18} /> ภาพรวม</button>
              <button type="button" onClick={() => goToSection("transactions")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-[#819087] transition hover:bg-[#f5f8f7] hover:text-[#23343b]"><ArrowRightLeft size={18} /> รายการล่าสุด</button>
              <button type="button" onClick={() => goToSection("savings")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-[#819087] transition hover:bg-[#f5f8f7] hover:text-[#23343b]"><Wallet size={18} /> บันทึกการออม</button>
            </nav>
          </aside>
        </div>
      )}

      {/* Main Layout */}
      <div className="mx-auto flex max-w-350">
        {/* Desktop Sidebar */}
        <aside className="hidden min-h-screen w-64 shrink-0 border-r border-[#e7eeeb] bg-white px-6 py-8 lg:block">
          <div className="flex items-center gap-3 text-[#23343b]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#80A867] text-white shadow-sm"><Landmark size={20} /></span>
            <span className="text-xl font-bold tracking-tight font-sans-en">POCKET<span className="text-[#DE98BC] font-light">BALANCE</span></span>
          </div>
          <nav className="mt-12 space-y-2">
            <button type="button" onClick={() => goToSection("overview")} className="flex w-full items-center gap-3 rounded-xl bg-[#EEF5E8] px-4 py-3 text-left text-sm font-semibold text-[#5D7F4A] transition-colors"><LayoutDashboard size={18} /> ภาพรวม</button>
            <button type="button" onClick={() => goToSection("transactions")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-[#819087] transition-colors hover:bg-[#EEF5E8] hover:text-[#5D7F4A]"><ArrowRightLeft size={18} /> รายการล่าสุด</button>
            <button type="button" onClick={() => goToSection("savings")} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-[#819087] transition-colors hover:bg-[#EEF5E8] hover:text-[#5D7F4A]"><Wallet size={18} /> บันทึกการออม</button>
          </nav>
          <div className="mt-auto pt-40 text-xs font-medium text-[#819087]">
            จัดการเงินของคุณง่ายๆ ในทุกวัน <br/> <span className="font-sans-en">© 2026 PocketBalance</span>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
          {/* Header */}
          <header className="flex items-center justify-between pb-6 border-b border-[#e7eeeb]">
            <div className="flex items-center gap-3 lg:hidden">
              <button type="button" aria-label="เปิดเมนู" onClick={() => setShowDrawer(true)} className="rounded-lg p-1.5 text-[#819087] hover:bg-[#f5f8f7] transition-colors"><Menu size={22} /></button>
              <span className="text-lg font-bold text-[#23343b] font-sans-en">POCKET<span className="text-[#DE98BC] font-light">BALANCE</span></span>
            </div>
            <div className="hidden lg:block">
              <h1 className="text-2xl font-semibold text-[#23343b]">ภาพรวม</h1>
              <p className="text-sm font-medium text-[#819087] mt-1">{todayLabel}</p>
            </div>
            <button onClick={openAddForm} className="flex items-center gap-2 rounded-xl bg-[#DE98BC] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(222,152,188,0.3)] transition hover:bg-[#B86C95] hover:shadow-[0_6px_20px_rgba(222,152,188,0.4)]">
              <CirclePlus size={18} /> <span className="hidden sm:inline">เพิ่มรายการใหม่</span><span className="sm:hidden">เพิ่มรายการ</span>
            </button>
          </header>

          {/* Summary Cards */}
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <SummaryCard label="ยอดคงเหลือ" value={balance} icon={<Landmark size={20} />} tone="primary" note={`รอบเดือน ${selectedMonthLabel}`} />
            <SummaryCard label="รายรับทั้งหมด" value={income} icon={<ArrowDownLeft size={20} />} tone="positive" note={`รายรับ ${selectedMonthLabel}`} />
            <SummaryCard label="รายจ่ายทั้งหมด" value={expense} icon={<ArrowUpRight size={20} />} tone="negative" note={`รายจ่าย ${selectedMonthLabel}`} />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            {/* Chart Section */}
            <section className="animate-rise rounded-2xl border border-[#e7eeeb] bg-white p-6 shadow-[0_4px_24px_rgba(35,52,59,0.03)]">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#23343b]">กระแสเงินสด</h2>
                  <p className="mt-1 text-sm text-[#819087]">รายรับ - รายจ่าย ย้อนหลัง 6 เดือน</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#819087]">
                  <select aria-label="เลือกช่วงเวลา" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent outline-none">
                    <option value="2025-01">มกราคม 2568</option><option value="2025-02">กุมภาพันธ์ 2568</option><option value="2025-03">มีนาคม 2568</option><option value="2025-04">เมษายน 2568</option><option value="2025-05">พฤษภาคม 2568</option><option value="2025-06">มิถุนายน 2568</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-5 text-sm text-[#819087] font-medium">
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-[#80A867]" />รายรับ</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-[#DE98BC]" />รายจ่าย</span>
              </div>
              <div className="mt-8 flex h-56 items-end gap-3 border-b border-[#e7eeeb] px-2 sm:gap-6">
                {monthData.map((item, index) => (
                  <button type="button" onClick={() => setSelectedMonth(`2025-${String(index + 1).padStart(2, "0")}`)} className={`group flex h-full flex-1 items-end justify-center gap-1.5 rounded-t-xl px-1 transition-colors ${selectedMonth === `2025-${String(index + 1).padStart(2, "0")}` ? "bg-[#fcfdfc]" : "hover:bg-[#fcfdfc]"}`} key={monthLabels[index]}>
                    <div title={`รายรับ ${money(item.income)} บาท`} className="w-3 rounded-t-md bg-[#80A867] transition-all group-hover:bg-[#5D7F4A] sm:w-6" style={{ height: `${item.income / 50000 * 100}%` }} />
                    <div title={`รายจ่าย ${money(item.expense)} บาท`} className="w-3 rounded-t-md bg-[#DE98BC] transition-all group-hover:bg-[#B86C95] sm:w-6" style={{ height: `${item.expense / 50000 * 100}%` }} />
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-between px-2 text-xs font-medium text-[#819087]">
                {monthLabels.map((label) => <span key={label}>{label}</span>)}
              </div>
            </section>

            {/* Recent Transactions (Short) */}
            <section className="animate-rise delay-2 rounded-2xl border border-[#e7eeeb] bg-white p-6 shadow-[0_4px_24px_rgba(35,52,59,0.03)]">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-[#e7eeeb] pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#23343b]">รายการล่าสุด</h2>
                  <p className="mt-1 text-sm text-[#819087]">ความเคลื่อนไหวล่าสุดของคุณ</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-[#e7eeeb] bg-[#fcfdfc] px-3 py-1.5 text-sm text-[#819087] focus-within:border-[#80A867] focus-within:bg-white transition-colors">
                    <Search size={16} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา..." className="w-20 bg-transparent outline-none placeholder:text-[#aab3ac] sm:w-28 font-sans-en" />
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button onClick={() => setActiveTab("all")} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "all" ? "bg-[#23343b] text-white" : "bg-[#f5f8f7] text-[#819087] hover:bg-[#e7eeeb]"}`}>ทั้งหมด</button>
                <button onClick={() => setActiveTab("income")} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "income" ? "bg-[#EEF5E8] text-[#5D7F4A]" : "bg-[#f5f8f7] text-[#819087] hover:bg-[#e7eeeb]"}`}>รายรับ</button>
                <button onClick={() => setActiveTab("expense")} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "expense" ? "bg-[#FBEAF2] text-[#B86C95]" : "bg-[#f5f8f7] text-[#819087] hover:bg-[#e7eeeb]"}`}>รายจ่าย</button>
              </div>

              <div className="mt-2 divide-y divide-[#e7eeeb]">
                {filtered.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 py-4 group">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${entry.type === "income" ? "bg-[#EEF5E8] text-[#5D7F4A]" : "bg-[#FBEAF2] text-[#B86C95]"}`}>
                        {entry.type === "income" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#23343b]">{entry.title}</p>
                        <p className="mt-0.5 text-xs text-[#819087]">{entry.category} • {dateText(entry.date)}</p>
                      </div>
                    </div>
                    <p className={`shrink-0 text-sm font-bold font-sans-en ${entry.type === "income" ? "text-[#5D7F4A]" : "text-[#23343b]"}`}>
                      {entry.type === "income" ? "+" : "-"}฿{money(entry.amount)}
                    </p>
                  </div>
                ))}
                {filtered.length === 0 && <p className="py-8 text-center text-sm text-[#819087]">ไม่พบรายการที่ค้นหา</p>}
              </div>
            </section>
          </div>
          
          {/* Savings Section (Side by side blocks instead of Full list) */}
          <section className="mt-12 flex flex-col md:flex-row gap-6 items-start">
            
            {/* Savings Goal Card */}
            <div className="w-full max-w-md rounded-2xl border border-[#e7eeeb] bg-white p-6 md:p-8 shadow-[0_4px_24px_rgba(35,52,59,0.03)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#819087]">เป้าหมายการออม</p>
                  <h2 className="mt-1 text-xl font-bold text-[#23343b]">{currentMonthLabel}</h2>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#EEF5E8] px-2.5 py-1 text-xs font-semibold text-[#5D7F4A]"><i className="h-1.5 w-1.5 rounded-full bg-[#80A867]" /> เดือนปัจจุบัน</span>
                </div>
                <button type="button" aria-label="แก้ไขการออมเดือนปัจจุบัน" onClick={() => { setDraftSaving(goal[currentMonthKey] || 0); setShowGoalForm((value) => !value); }} className="rounded-xl border border-[#e7eeeb] bg-white p-2.5 text-[#819087] shadow-sm transition hover:bg-[#EEF5E8] hover:text-[#5D7F4A]"><Pencil size={18} /></button>
              </div>
              
              <div className="mt-8 border-t border-[#e7eeeb] pt-6">
                <p className="text-sm font-medium text-[#819087]">ยอดออมของเดือนนี้</p>
                <p className="mt-1 font-sans-en text-4xl font-bold tracking-tight text-[#80A867]">฿{money(goal[currentMonthKey] || 0)}</p>
              </div>
              
              {showGoalForm && (
                <form onSubmit={saveGoal} className="mt-6 space-y-4 border-t border-[#e7eeeb] pt-6">
                  <label className="block text-sm font-medium text-[#23343b]">
                    ระบุจำนวนเงินที่ต้องการออม
                    <div className="relative mt-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#819087] font-sans-en">฿</span>
                      <input required min="0" type="number" step="0.01" value={draftSaving || ""} onChange={(event) => setDraftSaving(Number(event.target.value))} placeholder="0.00" className="w-full rounded-xl border border-[#e7eeeb] bg-white py-3 pl-8 pr-4 text-sm font-sans-en outline-none transition-colors focus:border-[#80A867] focus:ring-1 focus:ring-[#80A867]" />
                    </div>
                  </label>
                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 rounded-xl bg-[#80A867] py-3 text-sm font-semibold text-white hover:bg-[#5D7F4A] transition-colors">ยืนยัน</button>
                    <button type="button" onClick={() => setShowGoalForm(false)} className="flex-1 rounded-xl bg-[#f5f8f7] py-3 text-sm font-semibold text-[#819087] hover:bg-[#e7eeeb] transition-colors">ยกเลิก</button>
                  </div>
                </form>
              )}
            </div>

            {/* Mini Savings History */}
            <div className="w-full max-w-sm rounded-2xl border border-[#e7eeeb] bg-white p-5 md:p-6 shadow-[0_4px_24px_rgba(35,52,59,0.03)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#819087]">ประวัติ</p>
                  <h2 className="mt-1 text-base font-semibold text-[#23343b]">ประวัติการออม</h2>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5E8] text-[#5D7F4A]"><Wallet size={18} /></span>
              </div>
              <div className="mt-5 divide-y divide-[#e7eeeb]">
                {savingHistory.map((item) => (
                  <div key={item.month} className="flex items-center justify-between gap-3 py-3 group">
                    <div>
                      <span className="text-xs font-medium text-[#819087]">{new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${item.month}-01`))}</span>
                      <p className="mt-0.5 text-sm font-bold text-[#23343b] font-sans-en">฿{money(item.amount)}</p>
                    </div>
                    <button type="button" aria-label={`ลบข้อมูลการออม ${item.month}`} onClick={() => deleteSaving(item.month)} className="rounded-lg p-2 text-[#aab3ac] opacity-0 group-hover:opacity-100 hover:bg-[#FBEAF2] hover:text-[#B86C95] transition-all"><Trash2 size={16} /></button>
                  </div>
                ))}
                {savingHistory.length === 0 && <p className="py-6 text-center text-xs font-medium text-[#819087]">ยังไม่มีประวัติการออม</p>}
              </div>
            </div>

          </section>

          <p className="mt-12 text-center text-xs font-medium text-[#aab3ac]">ข้อมูลถูกจัดเก็บอย่างปลอดภัยบนอุปกรณ์นี้ • อัปเดตล่าสุดเมื่อสักครู่</p>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, icon, tone, note }: { label: string; value: number; icon: React.ReactNode; tone: "primary" | "positive" | "negative"; note: string }) {
  const styles = {
    primary: "bg-[#80A867] text-white icon-bg-white/20 icon-text-white border-transparent",
    positive: "bg-white text-[#23343b] icon-bg-[#EEF5E8] icon-text-[#5D7F4A] border-[#e7eeeb]",
    negative: "bg-white text-[#23343b] icon-bg-[#FBEAF2] icon-text-[#B86C95] border-[#e7eeeb]"
  };

  const currentStyle = styles[tone];

  return (
    <div className={`animate-rise rounded-2xl border p-6 shadow-[0_4px_24px_rgba(35,52,59,0.03)] transition-all hover:shadow-[0_6px_30px_rgba(35,52,59,0.05)] ${currentStyle}`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-medium ${tone === 'primary' ? 'text-[#EEF5E8]' : 'text-[#819087]'}`}>{label}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone === 'primary' ? 'bg-white/20 text-white' : tone === 'positive' ? 'bg-[#EEF5E8] text-[#5D7F4A]' : 'bg-[#FBEAF2] text-[#B86C95]'}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 font-sans-en text-3xl font-bold tracking-tight">฿{money(value)}</p>
      <p className={`mt-2 text-xs font-medium ${tone === 'primary' ? 'text-[#EEF5E8]/80' : 'text-[#aab3ac]'}`}>{note}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 z-40 overflow-auto bg-[#fcfdfc] px-5 py-6 sm:px-8 lg:px-10 lg:py-8" aria-busy="true" aria-label="กำลังโหลดข้อมูล">
      <div className="mx-auto max-w-350">
        <div className="flex items-center justify-between pb-6 border-b border-[#e7eeeb]">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-[#e7eeeb]" />
          <div className="h-10 w-36 animate-pulse rounded-xl bg-[#e7eeeb]" />
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="h-36 animate-pulse rounded-2xl bg-[#EEF5E8]" />
          <div className="h-36 animate-pulse rounded-2xl bg-white border border-[#e7eeeb] shadow-sm" />
          <div className="h-36 animate-pulse rounded-2xl bg-white border border-[#e7eeeb] shadow-sm" />
        </div>
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="h-96 animate-pulse rounded-2xl bg-white border border-[#e7eeeb] shadow-sm" />
          <div className="h-96 animate-pulse rounded-2xl bg-white border border-[#e7eeeb] shadow-sm" />
        </div>
      </div>
    </div>
  );
}