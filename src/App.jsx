import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, UserPlus, Download, Upload, RefreshCw, Search, Edit3, 
  Trash2, Heart, Shield, Plus, ChevronLeft, ChevronRight, X, 
  Camera, FileText, Calendar, Check, Info, List, Grid, User
} from 'lucide-react';

// Default Sample Data featuring the family members from the mockup
const INITIAL_SAMPLE_DATA = [
  {
    id: "p1",
    firstName: "Kapansa",
    lastName: "Bwalya",
    gender: "male",
    birthDate: "1986-10-13",
    deathDate: "",
    bio: "This was a good man. He was educated up to PhD in Engineering.",
    photoUrl: "",
    spouseId: "p2",
    parentIds: ["p3", "p4"]
  },
  {
    id: "p2",
    firstName: "Namangolezya",
    lastName: "Simuyuni",
    gender: "female",
    birthDate: "1988-05-23",
    deathDate: "",
    bio: "Accomplished architect and passionate community mentor.",
    photoUrl: "",
    spouseId: "p1",
    parentIds: []
  },
  {
    id: "p3",
    firstName: "Kingstone",
    lastName: "Bwalya",
    gender: "male",
    birthDate: "1954-02-10",
    deathDate: "2021-06-23",
    bio: "Patriarch of the family, spent 30 years in public education.",
    photoUrl: "",
    spouseId: "p4",
    parentIds: []
  },
  {
    id: "p4",
    firstName: "Priscilla",
    lastName: "Chikoyo",
    gender: "female",
    birthDate: "1958-09-18",
    deathDate: "",
    bio: "Devoted mother and respected local artisan.",
    photoUrl: "",
    spouseId: "p3",
    parentIds: []
  }
];

const LOCAL_STORAGE_KEY = "kapsa_tree_family_data_v1";

export default function App() {
  const [people, setPeople] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse local storage", e);
    }
    return INITIAL_SAMPLE_DATA;
  });

  const [activePersonId, setActivePersonId] = useState(() => people[0]?.id || "p1");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("carousel"); // 'carousel' or 'list'
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [personToEdit, setPersonToEdit] = useState(null);
  const [addKinContext, setAddKinContext] = useState(null); // { relationType: 'child'|'parent'|'spouse'|'sibling', targetPersonId }
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(people));
  }, [people]);

  const showToast = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const activePerson = useMemo(() => {
    return people.find(p => p.id === activePersonId) || people[0] || null;
  }, [people, activePersonId]);

  // Compute relationships for active person
  const relationships = useMemo(() => {
    if (!activePerson) return { spouse: null, parents: [], children: [], siblings: [] };

    const spouse = people.find(p => p.id === activePerson.spouseId) || null;
    const parents = people.filter(p => activePerson.parentIds?.includes(p.id));
    
    // Children: individuals who list activePerson in parentIds
    const children = people.filter(p => p.parentIds?.includes(activePerson.id));

    // Siblings: individuals who share at least one parent (and are not the person themselves)
    const siblings = people.filter(p => {
      if (p.id === activePerson.id) return false;
      if (!p.parentIds || p.parentIds.length === 0) return false;
      if (!activePerson.parentIds || activePerson.parentIds.length === 0) return false;
      return p.parentIds.some(parentId => activePerson.parentIds.includes(parentId));
    });

    return { spouse, parents, children, siblings };
  }, [people, activePerson]);

  // Filtered list for search results dropdown & list view
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const q = searchQuery.toLowerCase();
    return people.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q) ||
      p.birthDate?.includes(q)
    );
  }, [people, searchQuery]);

  const handleSavePerson = (formData) => {
    if (formData.id) {
      // Update existing
      setPeople(prev => prev.map(p => p.id === formData.id ? { ...p, ...formData } : p));
      showToast("Person updated successfully");
    } else {
      // Create new
      const newId = "p_" + Date.now();
      const newPerson = { ...formData, id: newId };
      
      let updatedPeople = [...people, newPerson];

      // Handle kin automatic reciprocal linkage if added via context
      if (addKinContext) {
        const { relationType, targetPersonId } = addKinContext;
        const target = updatedPeople.find(p => p.id === targetPersonId);

        if (target) {
          if (relationType === 'spouse') {
            // Set spouse links both ways
            newPerson.spouseId = target.id;
            updatedPeople = updatedPeople.map(p => p.id === target.id ? { ...p, spouseId: newId } : p);
          } else if (relationType === 'child') {
            // New person lists target as parent
            newPerson.parentIds = Array.from(new Set([...(newPerson.parentIds || []), target.id]));
          } else if (relationType === 'parent') {
            // Target lists new person as parent
            updatedPeople = updatedPeople.map(p => {
              if (p.id === target.id) {
                return { ...p, parentIds: Array.from(new Set([...(p.parentIds || []), newId])) };
              }
              return p;
            });
          } else if (relationType === 'sibling') {
            // Copy parents from target
            if (target.parentIds && target.parentIds.length > 0) {
              newPerson.parentIds = [...target.parentIds];
            }
          }
        }
      }

      setPeople(updatedPeople);
      setActivePersonId(newId);
      showToast("New family member added!");
    }

    setIsEditModalOpen(false);
    setPersonToEdit(null);
    setAddKinContext(null);
  };

  const handleDeletePerson = (id) => {
    setPeople(prev => {
      const filtered = prev.filter(p => p.id !== id);
      // Clean up references
      return filtered.map(p => ({
        ...p,
        spouseId: p.spouseId === id ? null : p.spouseId,
        parentIds: p.parentIds ? p.parentIds.filter(pid => pid !== id) : []
      }));
    });

    if (activePersonId === id) {
      const remaining = people.filter(p => p.id !== id);
      if (remaining.length > 0) {
        setActivePersonId(remaining[0].id);
      }
    }

    setDeleteConfirmId(null);
    showToast("Member deleted", "info");
  };

  const handleOpenAddKin = (relationType, targetPerson) => {
    setAddKinContext({ relationType, targetPersonId: targetPerson.id });
    
    // Default initial data based on relation
    const defaultData = {
      firstName: "",
      lastName: relationType === 'child' || relationType === 'sibling' ? targetPerson.lastName : "",
      gender: relationType === 'spouse' ? (targetPerson.gender === 'male' ? 'female' : 'male') : 'male',
      birthDate: "",
      deathDate: "",
      bio: "",
      photoUrl: "",
      spouseId: relationType === 'spouse' ? targetPerson.id : null,
      parentIds: relationType === 'child' ? [targetPerson.id] : (relationType === 'sibling' ? [...(targetPerson.parentIds || [])] : [])
    };
    
    setPersonToEdit(defaultData);
    setIsEditModalOpen(true);
  };

  // Import / Export logic
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(people, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `kapsa_family_tree_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Family tree exported successfully!");
  };

  const handleImportJSON = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed)) {
            setPeople(parsed);
            if (parsed.length > 0) setActivePersonId(parsed[0].id);
            showToast("Family tree imported successfully!");
            setIsImportExportOpen(false);
          } else {
            showToast("Invalid JSON format. Expected array of people.", "error");
          }
        } catch (err) {
          showToast("Failed to parse JSON file.", "error");
        }
      };
    }
  };

  const handleResetToSample = () => {
    setPeople(INITIAL_SAMPLE_DATA);
    setActivePersonId(INITIAL_SAMPLE_DATA[0].id);
    showToast("Reset to sample data", "info");
    setIsImportExportOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#efefef] flex flex-col font-sans text-gray-800 antialiased selection:bg-[#342435] selection:text-white">
      {/* Top Header - Matching style #342435 */}
      <header className="bg-[#342435] text-white px-4 md:px-8 py-3 shadow-md flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setViewMode('carousel')}>
          <div className="bg-amber-400 text-[#342435] p-2 rounded-lg font-bold text-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide leading-none">Kapsa Tree</h1>
            <span className="text-xs text-amber-200/80">Family Heritage & Genealogy</span>
          </div>
        </div>

        {/* Global Instant Search */}
        <div className="relative flex-1 max-w-xs md:max-w-md mx-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search family member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#48334a] text-white placeholder-gray-300 text-sm pl-9 pr-8 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 border border-[#58415a] transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                className="absolute right-2 text-gray-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Search Suggestions Dropdown */}
          {searchQuery.trim() !== "" && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white text-gray-800 rounded-lg shadow-2xl border border-gray-200 max-h-64 overflow-y-auto z-50 divide-y divide-gray-100">
              {searchResults.length > 0 ? (
                searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePersonId(p.id);
                      setSearchQuery("");
                      setViewMode("carousel");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-purple-50 flex items-center space-x-3 transition"
                  >
                    <img 
                      src={p.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"} 
                      alt="" 
                      className="w-8 h-8 rounded-full object-cover border border-gray-300"
                    />
                    <div className="truncate">
                      <div className="text-sm font-semibold text-gray-900">{p.firstName} <strong>{p.lastName}</strong></div>
                      <div className="text-xs text-gray-500 truncate">{p.bio || "No details available"}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-xs text-gray-500 text-center">No matching family members found</div>
              )}
            </div>
          )}
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPersonToEdit({
                firstName: "", lastName: "", gender: "male", birthDate: "", deathDate: "", bio: "", photoUrl: "", spouseId: null, parentIds: []
              });
              setAddKinContext(null);
              setIsEditModalOpen(true);
            }}
            className="px-3 py-1.5 bg-transparent border border-[#655566] text-white hover:bg-white/10 rounded-md text-sm font-semibold transition flex items-center space-x-1.5"
          >
            <UserPlus className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Add</span>
          </button>

          <button
            onClick={() => setViewMode(prev => prev === 'carousel' ? 'list' : 'carousel')}
            className={`px-3 py-1.5 border border-[#655566] rounded-md text-sm font-semibold transition flex items-center space-x-1.5 ${
              viewMode === 'list' ? 'bg-amber-400 text-[#342435]' : 'bg-transparent text-white hover:bg-white/10'
            }`}
          >
            {viewMode === 'carousel' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            <span className="hidden sm:inline">{viewMode === 'carousel' ? 'List View' : 'Carousel'}</span>
          </button>

          <button
            onClick={() => setIsImportExportOpen(true)}
            className="px-3 py-1.5 bg-transparent border border-[#655566] text-white hover:bg-white/10 rounded-md text-sm font-semibold transition flex items-center space-x-1.5"
            title="Import/Export Data"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span className="hidden md:inline">Data</span>
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-xl text-white flex items-center space-x-2 animate-bounce ${
          notification.type === 'error' ? 'bg-red-600' : notification.type === 'info' ? 'bg-blue-600' : 'bg-emerald-600'
        }`}>
          <Info className="w-5 h-5" />
          <span className="text-sm font-medium">{notification.msg}</span>
        </div>
      )}

      {}
      <main className="flex-1 overflow-x-hidden p-4 md:p-8 flex flex-col justify-start items-center">
        {people.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center max-w-md my-auto border border-gray-200">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Family Data Available</h2>
            <p className="text-sm text-gray-600 mb-6">Your family tree is currently empty. Add your first member or restore default sample data.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleResetToSample}
                className="px-4 py-2 bg-[#342435] text-white rounded-lg text-sm font-semibold hover:opacity-90"
              >
                Load Sample Tree
              </button>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          /* ListView Directory Mode */
          <ListView 
            people={searchResults} 
            activePersonId={activePersonId}
            onSelectPerson={(id) => {
              setActivePersonId(id);
              setViewMode('carousel');
            }}
            onEdit={(person) => {
              setPersonToEdit(person);
              setAddKinContext(null);
              setIsEditModalOpen(true);
            }}
            onDelete={(id) => setDeleteConfirmId(id)}
          />
        ) : (
          /* Accordion iPhone Photos Style Carousel View */
          activePerson && (
            <AccordionCarousel
              activePerson={activePerson}
              relationships={relationships}
              allPeople={people}
              onSelectPerson={setActivePersonId}
              onEditPerson={(p) => {
                setPersonToEdit(p);
                setAddKinContext(null);
                setIsEditModalOpen(true);
              }}
              onDeletePerson={(id) => setDeleteConfirmId(id)}
              onAddKin={handleOpenAddKin}
            />
          )
        )}
      </main>

      {}
      {/* Add / Edit Person Modal */}
      {isEditModalOpen && (
        <PersonFormModal
          personToEdit={personToEdit}
          allPeople={people}
          addKinContext={addKinContext}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSavePerson}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <DeleteConfirmModal
          person={people.find(p => p.id === deleteConfirmId)}
          onConfirm={() => handleDeletePerson(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {/* Import / Export Modal */}
      {isImportExportOpen && (
        <ImportExportModal
          onClose={() => setIsImportExportOpen(false)}
          onExport={handleExportJSON}
          onImport={handleImportJSON}
          onReset={handleResetToSample}
          count={people.length}
        />
      )}
    </div>
  );
}

function AccordionCarousel({ 
  activePerson, 
  relationships, 
  allPeople, 
  onSelectPerson, 
  onEditPerson, 
  onDeletePerson, 
  onAddKin 
}) {
  // Sibling Carousel elements: list of siblings including the active person
  const siblingTier = useMemo(() => {
    const list = [activePerson, ...relationships.siblings];
    // Deduplicate by id just in case
    return Array.from(new Map(list.map(item => [item.id, item])).values());
  }, [activePerson, relationships.siblings]);

  const activeIndex = siblingTier.findIndex(p => p.id === activePerson.id);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center space-y-6 my-auto">
      
      {/* Sibling Accordion Horizontal Slider (iPhone Memories Style) */}
      <div className="w-full bg-white/70 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center space-x-2 text-[#342435] font-semibold text-sm">
            <Users className="w-4 h-4 text-amber-600" />
            <span>Generation Sibling Carousel ({siblingTier.length})</span>
          </div>
          <span className="text-xs text-gray-500">Click sibling card to switch focus</span>
        </div>

        {/* Horizontal Stack Slider */}
        <div className="flex items-center justify-center space-x-2 md:space-x-4 overflow-x-auto py-2 px-2 no-scrollbar">
          {siblingTier.map((sibling, index) => {
            const isActive = sibling.id === activePerson.id;
            return (
              <div
                key={sibling.id}
                onClick={() => onSelectPerson(sibling.id)}
                className={`cursor-pointer transition-all duration-300 transform flex-shrink-0 flex flex-col items-center p-2 rounded-xl border ${
                  isActive 
                    ? 'w-36 md:w-44 bg-[#342435] text-white scale-105 shadow-xl border-amber-400 ring-2 ring-amber-400/50' 
                    : 'w-24 md:w-28 bg-white text-gray-700 hover:bg-gray-100 border-gray-200 opacity-80 hover:opacity-100 scale-95'
                }`}
              >
                <div className="relative mb-2">
                  <img
                    src={sibling.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200"}
                    alt={sibling.firstName}
                    className={`rounded-lg object-cover transition-all ${
                      isActive ? 'w-20 h-20 md:w-24 md:h-24 ring-2 ring-white/50' : 'w-12 h-12 md:w-16 md:h-16'
                    }`}
                  />
                  {isActive && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-[#342435] text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                      Active
                    </span>
                  )}
                </div>

                <div className="text-center w-full truncate">
                  <p className={`text-xs md:text-sm font-medium leading-tight truncate ${isActive ? 'text-white font-bold' : 'text-gray-800'}`}>
                    {sibling.firstName}
                  </p>
                  <p className={`text-[11px] truncate ${isActive ? 'text-amber-200' : 'text-gray-500'}`}>
                    {sibling.lastName}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Focus Card - Matching styling from user mockup */}
      <div className="w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden transition-all duration-300">
        
        {/* Card Header Bar */}
        <div className="bg-gradient-to-r from-[#342435] to-[#4a344c] px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 bg-white/10 px-2.5 py-1 rounded-full">
              {activePerson.gender === 'female' ? 'Female' : 'Male'}
            </span>
            {activePerson.birthDate && (
              <span className="text-xs text-gray-300">
                b. {new Date(activePerson.birthDate).getFullYear()}
                {activePerson.deathDate ? ` - d. ${new Date(activePerson.deathDate).getFullYear()}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEditPerson(activePerson)}
              className="p-1.5 text-gray-200 hover:text-white hover:bg-white/10 rounded-md transition"
              title="Edit Member"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDeletePerson(activePerson.id)}
              className="p-1.5 text-red-300 hover:text-red-100 hover:bg-red-500/20 rounded-md transition"
              title="Delete Member"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          
          {/* Avatar Picture Box */}
          <div className="w-full md:w-52 flex flex-col items-center">
            <div className="w-44 h-44 md:w-48 md:h-48 rounded-xl overflow-hidden bg-gray-200 border-2 border-[#342435]/20 shadow-md relative group">
              <img
                src={activePerson.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"}
                alt={`${activePerson.firstName} ${activePerson.lastName}`}
                className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400";
                }}
              />
            </div>
            
            {/* Quick Kin Buttons */}
            <div className="mt-4 w-full grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onAddKin('child', activePerson)}
                className="text-xs py-1.5 px-2 bg-purple-50 text-[#342435] border border-purple-200 rounded-md hover:bg-purple-100 transition flex items-center justify-center font-medium"
              >
                <Plus className="w-3 h-3 mr-1" /> Child
              </button>
              <button
                onClick={() => onAddKin('spouse', activePerson)}
                className="text-xs py-1.5 px-2 bg-pink-50 text-pink-700 border border-pink-200 rounded-md hover:bg-pink-100 transition flex items-center justify-center font-medium"
              >
                <Heart className="w-3 h-3 mr-1" /> Spouse
              </button>
              <button
                onClick={() => onAddKin('parent', activePerson)}
                className="text-xs py-1.5 px-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition flex items-center justify-center font-medium"
              >
                <Shield className="w-3 h-3 mr-1" /> Parent
              </button>
              <button
                onClick={() => onAddKin('sibling', activePerson)}
                className="text-xs py-1.5 px-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-md hover:bg-amber-100 transition flex items-center justify-center font-medium"
              >
                <Users className="w-3 h-3 mr-1" /> Sibling
              </button>
            </div>
          </div>

          {/* Details & Interactive Relationship Links */}
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-2xl md:text-3xl text-gray-900 font-normal">
                {activePerson.firstName} <strong className="font-extrabold text-[#342435]">{activePerson.lastName}</strong>
              </h2>
              {activePerson.birthDate && (
                <p className="text-xs text-gray-500 mt-1 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                  Born: {activePerson.birthDate} {activePerson.deathDate ? ` | Deceased: ${activePerson.deathDate}` : ''}
                </p>
              )}
            </div>

            {/* Relations Block */}
            <div className="space-y-2.5 bg-gray-50 p-4 rounded-xl border border-gray-200/80">
              
              {/* Spouse */}
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Spouse: </span>
                {relationships.spouse ? (
                  <button
                    onClick={() => onSelectPerson(relationships.spouse.id)}
                    className="text-purple-700 font-medium hover:underline hover:text-purple-900 transition"
                  >
                    {relationships.spouse.firstName} {relationships.spouse.lastName}
                  </button>
                ) : (
                  <span className="text-gray-400 italic">None specified</span>
                )}
              </div>

              {/* Parents */}
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Parents: </span>
                {relationships.parents.length > 0 ? (
                  relationships.parents.map((parent, idx) => (
                    <React.Fragment key={parent.id}>
                      <button
                        onClick={() => onSelectPerson(parent.id)}
                        className="text-purple-700 font-medium hover:underline hover:text-purple-900 transition"
                      >
                        {parent.firstName} {parent.lastName}
                      </button>
                      {idx < relationships.parents.length - 1 && <span className="text-gray-400">, </span>}
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-gray-400 italic">None specified</span>
                )}
              </div>

              {/* Children */}
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Children: </span>
                {relationships.children.length > 0 ? (
                  relationships.children.map((child, idx) => (
                    <React.Fragment key={child.id}>
                      <button
                        onClick={() => onSelectPerson(child.id)}
                        className="text-purple-700 font-medium hover:underline hover:text-purple-900 transition"
                      >
                        {child.firstName} {child.lastName}
                      </button>
                      {idx < relationships.children.length - 1 && <span className="text-gray-400">, </span>}
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-gray-400 italic">None specified</span>
                )}
              </div>

              {/* Siblings */}
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Siblings: </span>
                {relationships.siblings.length > 0 ? (
                  relationships.siblings.map((sib, idx) => (
                    <React.Fragment key={sib.id}>
                      <button
                        onClick={() => onSelectPerson(sib.id)}
                        className="text-purple-700 font-medium hover:underline hover:text-purple-900 transition"
                      >
                        {sib.firstName} {sib.lastName}
                      </button>
                      {idx < relationships.siblings.length - 1 && <span className="text-gray-400">, </span>}
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-gray-400 italic">None specified</span>
                )}
              </div>

              {/* Bio / Notes */}
              <div className="text-sm pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-600 block mb-0.5">Notes: </span>
                <p className="text-gray-700 leading-relaxed text-xs md:text-sm italic">
                  {activePerson.bio ? `"${activePerson.bio}"` : "No notes recorded for this individual."}
                </p>
              </div>
            </div>

            {/* Mockup matching bottom right action controls */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => onEditPerson(activePerson)}
                className="px-4 py-1.5 bg-[#342435] text-white text-xs font-semibold rounded-md hover:bg-[#48334a] shadow-sm transition"
              >
                Edit
              </button>
              <button
                onClick={() => onDeletePerson(activePerson.id)}
                className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700 shadow-sm transition"
              >
                Delete
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function ListView({ people, activePersonId, onSelectPerson, onEdit, onDelete }) {
  return (
    <div className="w-full max-w-4xl bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <div className="bg-[#342435] text-white px-6 py-4 flex justify-between items-center">
        <h2 className="font-bold text-lg">Family Directory ({people.length})</h2>
        <span className="text-xs text-amber-200">Click any row to focus on carousel view</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-100 text-xs uppercase text-gray-700 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">Member</th>
              <th className="px-6 py-3">Gender</th>
              <th className="px-6 py-3">Birth Year</th>
              <th className="px-6 py-3">Notes</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {people.map(p => (
              <tr 
                key={p.id}
                className={`hover:bg-purple-50/50 transition cursor-pointer ${p.id === activePersonId ? 'bg-purple-50 font-medium' : ''}`}
                onClick={() => onSelectPerson(p.id)}
              >
                <td className="px-6 py-3.5 flex items-center space-x-3">
                  <img
                    src={p.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-gray-300"
                  />
                  <div>
                    <div className="text-gray-900">{p.firstName} <strong className="font-bold">{p.lastName}</strong></div>
                  </div>
                </td>
                <td className="px-6 py-3.5 capitalize text-xs">{p.gender}</td>
                <td className="px-6 py-3.5 text-xs">
                  {p.birthDate ? new Date(p.birthDate).getFullYear() : '—'}
                </td>
                <td className="px-6 py-3.5 text-xs text-gray-500 max-w-xs truncate">
                  {p.bio || '—'}
                </td>
                <td className="px-6 py-3.5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onEdit(p)}
                    className="p-1 text-gray-600 hover:text-purple-700"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="p-1 text-gray-600 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PersonFormModal({ personToEdit, allPeople, addKinContext, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: personToEdit?.id || null,
    firstName: personToEdit?.firstName || "",
    lastName: personToEdit?.lastName || "",
    gender: personToEdit?.gender || "male",
    birthDate: personToEdit?.birthDate || "",
    deathDate: personToEdit?.deathDate || "",
    bio: personToEdit?.bio || "",
    photoUrl: personToEdit?.photoUrl || "",
    spouseId: personToEdit?.spouseId || "",
    parentIds: personToEdit?.parentIds || []
  });

  const availableSpouses = allPeople.filter(p => p.id !== formData.id);
  const availableParents = allPeople.filter(p => p.id !== formData.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert("Please provide both First Name and Last Name.");
      return;
    }
    onSave(formData);
  };

  const handleParentToggle = (parentId) => {
    setFormData(prev => {
      const exists = prev.parentIds.includes(parentId);
      if (exists) {
        return { ...prev, parentIds: prev.parentIds.filter(id => id !== parentId) };
      } else {
        if (prev.parentIds.length >= 2) {
          alert("Maximum of 2 biological parents allowed.");
          return prev;
        }
        return { ...prev, parentIds: [...prev.parentIds, parentId] };
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#342435] text-white px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-amber-300" />
            <span>
              {formData.id 
                ? 'Edit Person' 
                : addKinContext 
                ? `Add ${addKinContext.relationType.toUpperCase()}`
                : 'Add New Family Member'}
            </span>
          </h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#342435] focus:outline-none"
                placeholder="e.g. Kapansa"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name (Surname) *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#342435] focus:outline-none"
                placeholder="e.g. Bwalya"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#342435] focus:outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Spouse</label>
              <select
                value={formData.spouseId || ""}
                onChange={(e) => setFormData({ ...formData, spouseId: e.target.value || null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#342435] focus:outline-none"
              >
                <option value="">None / Single</option>
                {availableSpouses.map(p => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Birth Date</label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#342435] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Death Date (Optional)</label>
              <input
                type="date"
                value={formData.deathDate}
                onChange={(e) => setFormData({ ...formData, deathDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#342435] focus:outline-none"
              />
            </div>
          </div>

          {/* Parents Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Parents (Select up to 2)</label>
            <div className="border border-gray-200 rounded-lg p-2 max-h-32 overflow-y-auto divide-y divide-gray-100 bg-gray-50">
              {availableParents.map(p => {
                const isSelected = formData.parentIds.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center space-x-2 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleParentToggle(p.id)}
                      className="rounded text-[#342435] focus:ring-[#342435]"
                    />
                    <span>{p.firstName} {p.lastName}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Photo Image URL</label>
            <input
              type="url"
              value={formData.photoUrl}
              onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#342435] focus:outline-none"
              placeholder="https://images.unsplash.com/..."
            />
          </div>

          {/* Bio / Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes & Biography</label>
            <textarea
              rows={3}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#342435] focus:outline-none"
              placeholder="Add biography, education, career notes..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#342435] text-white rounded-lg text-sm font-semibold hover:bg-[#48334a] shadow-md"
            >
              Save Person
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

function DeleteConfirmModal({ person, onConfirm, onCancel }) {
  if (!person) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center border border-gray-200">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Member?</h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong className="text-gray-900">{person.firstName} {person.lastName}</strong>? This action will also adjust family connections.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 shadow"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportExportModal({ onClose, onExport, onImport, onReset, count }) {
  const fileInputRef = useRef(null);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
        <div className="bg-[#342435] text-white px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center space-x-2">
            <Download className="w-5 h-5 text-emerald-400" />
            <span>Family Data Backup</span>
          </h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-600">
            Currently storing <strong className="text-[#342435]">{count} family members</strong> in your browser's local storage.
          </p>

          <div className="space-y-3">
            <button
              onClick={onExport}
              className="w-full flex items-center justify-between p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition font-medium text-sm"
            >
              <span className="flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Export Family Tree JSON</span>
              </span>
              <span className="text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md font-bold">Download</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-between p-3 bg-purple-50 text-[#342435] border border-purple-200 rounded-xl hover:bg-purple-100 transition font-medium text-sm"
            >
              <span className="flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>Import JSON Backup File</span>
              </span>
              <span className="text-xs bg-purple-200 text-[#342435] px-2 py-0.5 rounded-md font-bold">Upload</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImport}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={onReset}
              className="w-full flex items-center justify-between p-3 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 transition font-medium text-sm"
            >
              <span className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-gray-500" />
                <span>Reset to Original Sample Tree</span>
              </span>
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md">Reset</span>
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}