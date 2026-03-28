import React, { useEffect, useState } from "react";
import { Plus, MapPin, Pencil, X, Phone, User, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

type Address = {
  id: number;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
};

export default function Addresses() {
  const token = localStorage.getItem("token");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
  });

  const fetchAddresses = async () => {
    try {
      const res = await fetch(
        "https://api.babatextiles.com/api/auth/addresses/",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok) setAddresses(data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? "PUT" : "POST";
    const url = editingId
      ? `http://api.babatextiles.com/api/auth/addresses/${editingId}/`
      : "http://api.babatextiles.com/api/auth/addresses/";

    const res = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success(editingId ? "Address updated!" : "Address saved!");
      setShowForm(false);
      setEditingId(null);
      setForm({
        name: "",
        phone: "",
        street: "",
        city: "",
        state: "",
        pincode: "",
      });
      fetchAddresses();
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this address?"))
      return;

    const res = await fetch(
      `http://api.babatextiles.com/api/auth/addresses/${id}/`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (res.ok) {
      toast.info("Address removed");
      fetchAddresses();
    }
  };

  const handleEdit = (addr: Address) => {
    setForm({ ...addr });
    setEditingId(addr.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="bg-baba-softbg min-h-screen py-16 px-4">
      {/* Container restricted to 800px for a more professional, centered look */}
      <div className="max-w-3xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-12 text-center sm:text-left">
          <div>
            <h1 className="text-4xl font-serif font-bold text-baba-primary tracking-tight">
              Saved Addresses
            </h1>
            <p className="text-gray-500 mt-2">
              Update your delivery destinations for wholesale orders
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setForm({
                name: "",
                phone: "",
                street: "",
                city: "",
                state: "",
                pincode: "",
              });
            }}
            className="flex items-center gap-2 bg-baba-primary text-white px-6 py-3 rounded-sm hover:bg-baba-accent transition shadow-lg font-bold uppercase tracking-widest text-xs"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Cancel" : "Add New Address"}
          </button>
        </header>

        {/* ================= FORM SECTION ================= */}
        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleSubmit}
              className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 mb-12"
            >
              <h2 className="text-xl font-serif font-bold text-baba-primary mb-8 flex items-center gap-2">
                <MapPin className="text-baba-accent" size={20} />
                {editingId ? "Modify Address" : "Entry New Address"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Full Name
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full border-b border-gray-200 py-3 focus:border-baba-accent outline-none transition-colors"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Contact Number
                  </label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full border-b border-gray-200 py-3 focus:border-baba-accent outline-none transition-colors"
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Street / Area / Landmark
                  </label>
                  <input
                    name="street"
                    value={form.street}
                    onChange={handleChange}
                    className="w-full border-b border-gray-200 py-3 focus:border-baba-accent outline-none transition-colors"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 md:col-span-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      City
                    </label>
                    <input
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      className="w-full border-b border-gray-200 py-3 focus:border-baba-accent outline-none transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      State
                    </label>
                    <input
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      className="w-full border-b border-gray-200 py-3 focus:border-baba-accent outline-none transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      PIN
                    </label>
                    <input
                      name="pincode"
                      value={form.pincode}
                      onChange={handleChange}
                      className="w-full border-b border-gray-200 py-3 focus:border-baba-accent outline-none transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>
              <button className="w-full bg-baba-primary text-white py-4 rounded-sm font-black uppercase tracking-widest text-xs hover:bg-baba-accent transition mt-10 shadow-lg">
                {editingId ? "Update Information" : "Save and Continue"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* ================= LIST SECTION ================= */}
        <div className="flex flex-col gap-6">
          {addresses.length === 0 && !showForm && (
            <div className="py-24 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <MapPin size={48} className="mx-auto text-gray-100 mb-4" />
              <p className="text-gray-400 font-serif text-lg italic">
                No shipping addresses saved yet.
              </p>
            </div>
          )}

          {addresses.map((addr) => (
            <motion.div
              layout
              key={addr.id}
              className="bg-white p-10 rounded-2xl border border-gray-100 shadow-sm relative group hover:shadow-xl transition-all duration-300"
            >
              <div className="absolute top-6 right-6 flex gap-2">
                <button
                  onClick={() => handleEdit(addr)}
                  className="p-3 bg-gray-50 text-gray-400 rounded-full hover:bg-baba-primary hover:text-white transition shadow-sm"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="p-3 bg-gray-50 text-gray-400 rounded-full hover:bg-red-500 hover:text-white transition shadow-sm"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-baba-softbg rounded-lg">
                  <User size={20} className="text-baba-accent" />
                </div>
                <span className="font-serif text-2xl font-bold text-baba-primary">
                  {addr.name}
                </span>
              </div>

              <div className="text-lg text-gray-600 space-y-2 ml-12">
                <p className="leading-relaxed">{addr.street}</p>
                <p className="font-medium">
                  {addr.city}, {addr.state} — {addr.pincode}
                </p>

                <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-50">
                  <Phone size={18} className="text-baba-accent" />
                  <span className="font-mono text-baba-primary font-bold tracking-wider">
                    {addr.phone}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
