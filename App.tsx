
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { InventoryItem, View, ModalType, Category } from './types';
import { CATEGORIES, STATUSES, STATUS_COLORS } from './constants';
import Modal from './components/Modal';
import { EditIcon, DeleteIcon, SearchIcon, PlusIcon, ReportIcon, PrintIcon, CloseIcon } from './components/Icon';

// Helper: Local Storage Service
const LocalStorageService = {
  getInventory: (): InventoryItem[] => {
    const itemsJson = localStorage.getItem('inventoryItems');
    return itemsJson ? JSON.parse(itemsJson) : [];
  },
  saveInventory: (items: InventoryItem[]) => {
    localStorage.setItem('inventoryItems', JSON.stringify(items));
  },
};

// Helper to get next serial suffix
const getNextSerialSuffix = (items: InventoryItem[], prefix: string): string => {
  const existingSuffixes = items
    .filter(item => item.category === Object.keys(CATEGORIES).find(key => CATEGORIES[key].prefix === prefix))
    .map(item => parseInt(item.serialSuffix, 10))
    .filter(num => !isNaN(num));
  
  const maxSuffix = existingSuffixes.length > 0 ? Math.max(...existingSuffixes) : 0;
  return (maxSuffix + 1).toString().padStart(4, '0');
};

const App: React.FC = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [currentView, setCurrentView] = useState<View>(View.Summary);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null); // For single delete
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSelectionModeActive, setIsSelectionModeActive] = useState<boolean>(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Load inventory from local storage on mount
  useEffect(() => {
    setInventoryItems(LocalStorageService.getInventory());
  }, []);

  // Save inventory to local storage when it changes
  useEffect(() => {
    LocalStorageService.saveInventory(inventoryItems);
  }, [inventoryItems]);

  const handleOpenModal = (modalType: ModalType, itemId?: string) => {
    setActiveModal(modalType);
    if (itemId) {
      if (modalType === 'editItem') setEditingItemId(itemId);
      if (modalType === 'confirmDelete') setItemToDelete(itemId);
    } else {
      setEditingItemId(null);
      setItemToDelete(null);
    }
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setEditingItemId(null);
    setItemToDelete(null);
  };

  const handleSaveItem = (itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'serialSuffix'> & { id?: string; serialSuffix?: string; quantityToCreate?: number }) => {
    if (itemData.id) { // Editing existing item
      setInventoryItems(prevItems =>
        prevItems.map(item => (item.id === itemData.id ? { ...item, ...itemData, serialSuffix: item.serialSuffix } : item))
      );
    } else { // Adding new item(s)
      const categoryPrefix = CATEGORIES[itemData.category].prefix;
      const quantity = itemData.quantityToCreate || 1;
      const newItems: InventoryItem[] = [];
      let currentMaxSuffix = parseInt(getNextSerialSuffix(inventoryItems, categoryPrefix), 10) -1;

      for (let i = 0; i < quantity; i++) {
        currentMaxSuffix++;
        const newItem: InventoryItem = {
          ...itemData,
          id: crypto.randomUUID(),
          serialSuffix: currentMaxSuffix.toString().padStart(4, '0'),
          createdAt: new Date().toISOString(),
        };
        newItems.push(newItem);
      }
      setInventoryItems(prevItems => [...prevItems, ...newItems]);
    }
    handleCloseModal();
  };
  
  const handleDeleteItem = () => {
    if (itemToDelete) {
      setInventoryItems(prevItems => prevItems.filter(item => item.id !== itemToDelete));
    }
    handleCloseModal();
  };

  const handleBatchDelete = () => {
    setInventoryItems(prevItems => prevItems.filter(item => !selectedItemIds.has(item.id)));
    setSelectedItemIds(new Set());
    setIsSelectionModeActive(false); // Optionally disable selection mode after batch action
    handleCloseModal();
  };
  
  const handleSaveBatchEdit = (updates: Partial<Pick<InventoryItem, 'location' | 'status' | 'assignedTo'>>) => {
    setInventoryItems(prevItems =>
      prevItems.map(item => {
        if (selectedItemIds.has(item.id)) {
          let updatedItem = { ...item };
          if (updates.location !== undefined) updatedItem.location = updates.location;
          if (updates.status !== undefined) updatedItem.status = updates.status;
          if (updates.assignedTo !== undefined) { // Check if 'assignedTo' is part of updates
            if (updates.status === "Asignado" || (updates.status === undefined && item.status === "Asignado")) {
                 updatedItem.assignedTo = updates.assignedTo;
            } else { // If status is not "Asignado", clear assignedTo
                 updatedItem.assignedTo = '';
            }
          } else if (updates.status !== undefined && updates.status !== "Asignado") { 
            // If status is changed to not "Asignado" and assignedTo was not explicitly updated
            updatedItem.assignedTo = '';
          }
          return updatedItem;
        }
        return item;
      })
    );
    setSelectedItemIds(new Set());
    setIsSelectionModeActive(false);
    handleCloseModal();
  };

  const navigateToDetailView = (categoryKey: string) => {
    setSelectedCategoryKey(categoryKey);
    setCurrentView(View.Detail);
    setIsSelectionModeActive(false);
    setSelectedItemIds(new Set());
    setSearchTerm('');
  };

  const navigateToSummaryView = () => {
    setCurrentView(View.Summary);
    setSelectedCategoryKey(null);
    setIsSelectionModeActive(false);
    setSelectedItemIds(new Set());
  };

  const toggleSelectionMode = () => {
    setIsSelectionModeActive(!isSelectionModeActive);
    if (isSelectionModeActive) { // if turning off
        setSelectedItemIds(new Set());
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
      return newSelected;
    });
  };

  const currentCategoryItems = useMemo(() => {
    if (!selectedCategoryKey) return [];
    return inventoryItems
      .filter(item => item.category === selectedCategoryKey)
      .filter(item => {
        const fullSerial = `${CATEGORIES[item.category]?.prefix || ''}${item.serialSuffix}`;
        return (
          item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fullSerial.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.assignedTo && item.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      });
  }, [inventoryItems, selectedCategoryKey, searchTerm]);

  const handleSelectAllVisible = () => {
    const visibleIds = new Set(currentCategoryItems.map(item => item.id));
    setSelectedItemIds(visibleIds);
  };

  const handleDeselectAll = () => {
    setSelectedItemIds(new Set());
  };
  
  // Render functions / sub-components
  const renderSummaryView = () => (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold text-white">Resumen de Inventario</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.keys(CATEGORIES).map(catKey => {
          const count = inventoryItems.filter(item => item.category === catKey).length;
          return (
            <div
              key={catKey}
              onClick={() => navigateToDetailView(catKey)}
              className="bg-gray-800 p-6 rounded-lg shadow-lg hover:bg-gray-700 cursor-pointer transition-colors"
            >
              <h3 className="text-xl font-medium text-blue-400">{CATEGORIES[catKey].name}</h3>
              <p className="text-gray-300 mt-2">Cantidad: {count}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDetailView = () => {
    if (!selectedCategoryKey) return <p>Categoría no seleccionada.</p>;
    const categoryName = CATEGORIES[selectedCategoryKey]?.name || 'Desconocida';

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-3xl font-semibold text-white">Detalle de: {categoryName}</h2>
          <button onClick={navigateToSummaryView} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">
            Volver al Resumen
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <input
              type="text"
              id="searchDetail"
              placeholder="Buscar por descripción, N/S, ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md py-2 px-4 pl-10 focus:ring-blue-500 focus:border-blue-500"
            />
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          </div>
          <button 
            onClick={toggleSelectionMode} 
            className={`py-2 px-4 rounded font-semibold transition-colors ${isSelectionModeActive ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
          >
            {isSelectionModeActive ? 'Desactivar Selección' : 'Activar Selección Múltiple'}
          </button>
        </div>

        {isSelectionModeActive && (
          <div id="batchActionsContainer" className="bg-gray-700 p-3 rounded-md shadow flex flex-col sm:flex-row justify-between items-center gap-2">
            <span id="batchActionsCount" className="text-sm text-gray-300">
              {selectedItemIds.size} ítem(s) seleccionados
            </span>
            <div className="flex flex-wrap gap-2">
              <button id="selectAllVisibleBtn" onClick={handleSelectAllVisible} className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-3 rounded">Seleccionar Todos Visibles</button>
              <button id="deselectAllBtn" onClick={handleDeselectAll} className="bg-gray-500 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded">Deseleccionar Todos</button>
              <button id="batchEditSelectedBtn" onClick={() => handleOpenModal('batchEdit')} disabled={selectedItemIds.size === 0} className="bg-yellow-500 hover:bg-yellow-600 text-black text-xs py-1 px-3 rounded disabled:opacity-50">Editar Seleccionados</button>
              <button id="batchDeleteSelectedBtn" onClick={() => handleOpenModal('confirmBatchDelete')} disabled={selectedItemIds.size === 0} className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-3 rounded disabled:opacity-50">Eliminar Seleccionados</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto bg-gray-800 shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                {isSelectionModeActive && <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-12">Sel.</th>}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">N/S Completo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Asignado A</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {currentCategoryItems.map(item => (
                <tr 
                  key={item.id} 
                  className={`hover:bg-gray-700 transition-colors ${selectedItemIds.has(item.id) ? 'bg-blue-900' : ''}`}
                  onClick={() => isSelectionModeActive && handleSelectItem(item.id)}
                >
                  {isSelectionModeActive && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        checked={selectedItemIds.has(item.id)} 
                        onChange={() => handleSelectItem(item.id)}
                        className="form-checkbox h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{`${CATEGORIES[item.category]?.prefix || ''}${item.serialSuffix}`}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[item.status] || STATUS_COLORS.default} text-white`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.assignedTo || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {!isSelectionModeActive && (
                      <div className="flex space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal('editItem', item.id);}} className="text-blue-400 hover:text-blue-300 p-1" title="Editar"><EditIcon /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal('confirmDelete', item.id);}} className="text-red-400 hover:text-red-300 p-1" title="Eliminar"><DeleteIcon /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {currentCategoryItems.length === 0 && (
                <tr>
                  <td colSpan={isSelectionModeActive ? 7 : 6} className="text-center py-4 text-gray-500">No hay ítems para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const itemBeingEdited = useMemo(() => {
      if (!editingItemId) return null;
      return inventoryItems.find(item => item.id === editingItemId) || null;
  }, [editingItemId, inventoryItems]);


  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 shadow-md sticky top-0 z-40 no-print">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-3xl font-bold text-white mb-2 sm:mb-0">Sistema de Inventario</h1>
          <div className="flex space-x-3">
            <button id="generateReportBtn" onClick={() => handleOpenModal('report')} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded inline-flex items-center gap-2 transition-colors">
              <ReportIcon /> Generar Informe
            </button>
            <button id="addItemBtn" onClick={() => handleOpenModal('addItem')} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded inline-flex items-center gap-2 transition-colors">
              <PlusIcon /> Añadir Item
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-grow">
        {currentView === View.Summary ? renderSummaryView() : renderDetailView()}
      </main>

      <footer className="bg-gray-800 text-center p-4 text-sm text-gray-400 no-print">
        &copy; {new Date().getFullYear()} Sistema de Inventario. Todos los derechos reservados.
      </footer>

      {/* Item Modal (Add/Edit) */}
      <ItemModalComponent 
        isOpen={activeModal === 'addItem' || activeModal === 'editItem'}
        onClose={handleCloseModal}
        onSave={handleSaveItem}
        itemToEdit={itemBeingEdited}
        inventoryItems={inventoryItems}
      />

      {/* Report Modal */}
      <ReportModalComponent
        isOpen={activeModal === 'report'}
        onClose={handleCloseModal}
        inventoryItems={inventoryItems}
      />
      
      {/* Batch Edit Modal */}
      <BatchEditModalComponent
        isOpen={activeModal === 'batchEdit'}
        onClose={handleCloseModal}
        onSave={handleSaveBatchEdit}
        selectedItemCount={selectedItemIds.size}
      />

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={activeModal === 'confirmDelete'}
        onClose={handleCloseModal}
        title="Confirmar Eliminación"
        size="sm"
      >
        <div id="confirmDeleteModalContent" className="space-y-4">
          <p id="confirmDeleteMessage" className="text-gray-300">¿Está seguro de que desea eliminar este ítem? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end space-x-3">
            <button id="confirmDeleteCancelBtn" onClick={handleCloseModal} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors">Cancelar</button>
            <button id="confirmDeleteConfirmBtn" onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition-colors">Confirmar Eliminación</button>
          </div>
        </div>
      </Modal>

      {/* Confirm Batch Delete Modal */}
       <Modal
        isOpen={activeModal === 'confirmBatchDelete'}
        onClose={handleCloseModal}
        title="Confirmar Eliminación en Lote"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">¿Está seguro de que desea eliminar {selectedItemIds.size} ítem(s) seleccionados? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end space-x-3">
            <button onClick={handleCloseModal} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors">Cancelar</button>
            <button onClick={handleBatchDelete} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition-colors">Confirmar Eliminación</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};


// Sub-components for Modals (defined within App.tsx or could be separate files in a larger app)

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<InventoryItem, 'id' | 'createdAt' | 'serialSuffix'> & { id?: string; serialSuffix?: string; quantityToCreate?: number }) => void;
  itemToEdit: InventoryItem | null;
  inventoryItems: InventoryItem[];
}

const ItemModalComponent: React.FC<ItemModalProps> = ({ isOpen, onClose, onSave, itemToEdit, inventoryItems }) => {
  const [category, setCategory] = useState<string>(itemToEdit?.category || Object.keys(CATEGORIES)[0]);
  const [serialSuffix, setSerialSuffix] = useState<string>('');
  const [quantityToCreate, setQuantityToCreate] = useState<number>(1);
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [status, setStatus] = useState<string>(STATUSES[0]);
  const [assignedTo, setAssignedTo] = useState<string>('');

  useEffect(() => {
    if (itemToEdit) {
      setCategory(itemToEdit.category);
      setSerialSuffix(itemToEdit.serialSuffix);
      setDescription(itemToEdit.description);
      setLocation(itemToEdit.location);
      setStatus(itemToEdit.status);
      setAssignedTo(itemToEdit.assignedTo || '');
      setQuantityToCreate(1); // Not applicable for edit
    } else { // Reset for new item
      setCategory(Object.keys(CATEGORIES)[0]);
      // Serial suffix for new items is calculated on save or could be displayed if needed
      setSerialSuffix(''); // Displayed as readonly, calculated on save
      setDescription('');
      setLocation('');
      setStatus(STATUSES[0]);
      setAssignedTo('');
      setQuantityToCreate(1);
    }
  }, [itemToEdit, isOpen]); // isOpen to reset form when re-opened for new item

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: itemToEdit?.id,
      category,
      // serialSuffix will be handled by parent for new items
      description,
      location,
      status,
      assignedTo: status === "Asignado" ? assignedTo : '',
      quantityToCreate: itemToEdit ? undefined : quantityToCreate,
    });
  };
  
  const calculatedSerialSuffix = useMemo(() => {
    if (itemToEdit) return itemToEdit.serialSuffix;
    // For new items, this is just illustrative, actual suffix is set on save
    // return getNextSerialSuffix(inventoryItems, CATEGORIES[category]?.prefix); 
    return 'Se generará al guardar';
  }, [itemToEdit, category, inventoryItems]);


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={itemToEdit ? 'Editar Ítem' : 'Añadir Ítem'} size="lg">
      <form onSubmit={handleSubmit} id="itemForm" className="space-y-4">
        <input type="hidden" id="itemId" value={itemToEdit?.id || ''} />
        
        {/* Category */}
        <div className="form-group">
          <label htmlFor="itemCategory" className="block text-sm font-medium text-gray-300">Categoría</label>
          <select id="itemCategory" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!!itemToEdit}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-600 disabled:opacity-70">
            {Object.keys(CATEGORIES).map(catKey => (
              <option key={catKey} value={catKey}>{CATEGORIES[catKey].name}</option>
            ))}
          </select>
        </div>

        {/* Serial Suffix */}
        <div id="serialSuffixGroup" className="form-group">
            <label htmlFor="itemSerialSuffix" className="block text-sm font-medium text-gray-300">Número de Serie (Sufijo)</label>
            <input type="text" id="itemSerialSuffix" value={itemToEdit ? itemToEdit.serialSuffix : calculatedSerialSuffix} readOnly
            className="mt-1 block w-full bg-gray-600 border border-gray-500 text-gray-400 rounded-md p-2 cursor-not-allowed" />
        </div>
        
        {/* Quantity to Create (only for new items) */}
        {!itemToEdit && (
          <div id="quantityToCreateGroup" className="form-group">
            <label htmlFor="itemQuantityToCreate" className="block text-sm font-medium text-gray-300">Cantidad a Crear</label>
            <input type="number" id="itemQuantityToCreate" value={quantityToCreate} min="1" onChange={(e) => setQuantityToCreate(parseInt(e.target.value))}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        )}

        {/* Description */}
        <div className="form-group">
          <label htmlFor="itemDescription" className="block text-sm font-medium text-gray-300">Descripción</label>
          <textarea id="itemDescription" value={description} onChange={(e) => setDescription(e.target.value)} required rows={3}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
        </div>

        {/* Location */}
        <div className="form-group">
          <label htmlFor="itemLocation" className="block text-sm font-medium text-gray-300">Ubicación</label>
          <input type="text" id="itemLocation" value={location} onChange={(e) => setLocation(e.target.value)} required
            className="mt-1 block w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        
        {/* Status */}
        <div className="form-group">
          <label htmlFor="itemStatus" className="block text-sm font-medium text-gray-300">Estado</label>
          <select id="itemStatus" value={status} onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500">
            {STATUSES.map(stat => (<option key={stat} value={stat}>{stat}</option>))}
          </select>
        </div>

        {/* Assigned To (visible and required if status is 'Asignado') */}
        {status === "Asignado" && (
          <div id="assignedToGroup" className="form-group">
            <label htmlFor="itemAssignedTo" className="block text-sm font-medium text-gray-300">Asignado A</label>
            <input type="text" id="itemAssignedTo" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required={status === "Asignado"}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" id="cancelModalBtn" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors">Cancelar</button>
          <button type="submit" id="saveItemBtn" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors">Guardar</button>
        </div>
      </form>
    </Modal>
  );
};

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: InventoryItem[];
}
const ReportModalComponent: React.FC<ReportModalProps> = ({ isOpen, onClose, inventoryItems }) => {
  const reportData = useMemo(() => {
    if (!isOpen) return null;
    const totalItems = inventoryItems.length;
    const countsByStatus: Record<string, number> = {};
    STATUSES.forEach(s => countsByStatus[s] = 0);
    inventoryItems.forEach(item => {
      countsByStatus[item.status] = (countsByStatus[item.status] || 0) + 1;
    });

    const countsByCategory: Record<string, number> = {};
    Object.keys(CATEGORIES).forEach(ck => countsByCategory[CATEGORIES[ck].name] = 0);
    inventoryItems.forEach(item => {
      const categoryName = CATEGORIES[item.category]?.name || 'Desconocida';
      countsByCategory[categoryName] = (countsByCategory[categoryName] || 0) + 1;
    });
    return { totalItems, countsByStatus, countsByCategory };
  }, [isOpen, inventoryItems]);

  if (!reportData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Informe de Inventario" size="xl" >
      <div id="reportContentContainer" className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        <div className="text-gray-300">
          <h3 className="text-xl font-semibold text-white mb-2">Resumen General</h3>
          <p>Total de Ítems en Inventario: <span className="font-bold text-blue-400">{reportData.totalItems}</span></p>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Ítems por Estado</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            {Object.entries(reportData.countsByStatus).map(([status, count]) => (
              <li key={status}>{status}: <span className="font-bold text-blue-400">{count}</span></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Ítems por Categoría</h3>
           <ul className="list-disc list-inside space-y-1 text-gray-300">
            {Object.entries(reportData.countsByCategory).map(([category, count]) => (
              <li key={category}>{category}: <span className="font-bold text-blue-400">{count}</span></li>
            ))}
          </ul>
        </div>
        
        {/* Optional: Full list if needed, for brevity keeping it summary based */}
        {/* <h3 className="text-xl font-semibold text-white mb-2 mt-4">Listado Completo (Primeros 50)</h3>
        <div className="overflow-x-auto bg-gray-700 shadow-md rounded-lg"> ... Table ... </div> */}

      </div>
      <div className="flex justify-end space-x-3 pt-6 no-print">
        <button id="cancelReportModalBtn" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors">Cerrar</button>
        <button id="printReportBtn" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded inline-flex items-center gap-2 transition-colors">
          <PrintIcon /> Imprimir Informe
        </button>
      </div>
    </Modal>
  );
};

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Pick<InventoryItem, 'location' | 'status' | 'assignedTo'>>) => void;
  selectedItemCount: number;
}
const BatchEditModalComponent: React.FC<BatchEditModalProps> = ({ isOpen, onClose, onSave, selectedItemCount }) => {
  const [changeLocation, setChangeLocation] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [changeStatus, setChangeStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(STATUSES[0]);
  const [changeAssignedTo, setChangeAssignedTo] = useState(false);
  const [newAssignedTo, setNewAssignedTo] = useState('');

  useEffect(() => { // Reset form when modal opens/closes or selection changes
    if (isOpen) {
      setChangeLocation(false);
      setNewLocation('');
      setChangeStatus(false);
      setNewStatus(STATUSES[0]);
      setChangeAssignedTo(false);
      setNewAssignedTo('');
    }
  }, [isOpen, selectedItemCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<Pick<InventoryItem, 'location' | 'status' | 'assignedTo'>> = {};
    if (changeLocation) updates.location = newLocation;
    if (changeStatus) updates.status = newStatus;
    // Only include assignedTo if its checkbox is checked AND (new status is "Asignado" OR status is not being changed and we assume items might already be "Asignado")
    if (changeAssignedTo) {
        updates.assignedTo = newAssignedTo;
    }
    // If status is explicitly changed to something other than "Asignado", assignedTo should be cleared unless explicitly set otherwise
    if (changeStatus && newStatus !== "Asignado" && !changeAssignedTo) {
        updates.assignedTo = ''; 
    }
    
    onSave(updates);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Ítems en Lote" size="lg">
      <form id="batchEditForm" onSubmit={handleSubmit} className="space-y-6">
        <p id="batchEditItemCount" className="text-gray-300">Editando {selectedItemCount} ítem(s) seleccionados.</p>

        {/* Location */}
        <div className="batch-edit-field p-3 border border-gray-700 rounded-md">
          <div className="flex items-center mb-2">
            <input type="checkbox" id="batchEditChangeLocation" checked={changeLocation} onChange={(e) => setChangeLocation(e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
            <label htmlFor="batchEditChangeLocation" className="ml-2 text-sm font-medium text-gray-300">Cambiar Ubicación</label>
          </div>
          <input type="text" id="batchEditLocation" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} disabled={!changeLocation}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-600 disabled:opacity-70" />
        </div>

        {/* Status */}
        <div className="batch-edit-field p-3 border border-gray-700 rounded-md">
          <div className="flex items-center mb-2">
            <input type="checkbox" id="batchEditChangeStatus" checked={changeStatus} onChange={(e) => setChangeStatus(e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
            <label htmlFor="batchEditChangeStatus" className="ml-2 text-sm font-medium text-gray-300">Cambiar Estado</label>
          </div>
          <select id="batchEditStatus" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} disabled={!changeStatus}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-600 disabled:opacity-70">
            {STATUSES.map(stat => (<option key={stat} value={stat}>{stat}</option>))}
          </select>
        </div>
        
        {/* Assigned To */}
        { (changeStatus && newStatus === "Asignado") || (!changeStatus) && /* (allow changing assignedTo if status isn't changing, assuming items might be 'Asignado') */ true }
        <div className="batch-edit-field p-3 border border-gray-700 rounded-md">
          <div className="flex items-center mb-2">
            <input type="checkbox" id="batchEditChangeAssignedTo" checked={changeAssignedTo} onChange={(e) => setChangeAssignedTo(e.target.checked)} 
                   disabled={changeStatus && newStatus !== "Asignado"} /* Disable if status is changing to non-Asignado */
                   className="form-checkbox h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 disabled:opacity-50" />
            <label htmlFor="batchEditChangeAssignedTo" className={`ml-2 text-sm font-medium text-gray-300 ${(changeStatus && newStatus !== "Asignado") ? 'opacity-50' : ''}`}>Cambiar Asignado A</label>
          </div>
          <input type="text" id="batchEditAssignedTo" value={newAssignedTo} onChange={(e) => setNewAssignedTo(e.target.value)} 
                 disabled={!changeAssignedTo || (changeStatus && newStatus !== "Asignado")}
                 className="mt-1 block w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-600 disabled:opacity-70" />
           {changeStatus && newStatus !== "Asignado" && <p className="text-xs text-yellow-400 mt-1">El campo 'Asignado A' se vaciará ya que el estado no es 'Asignado'.</p>}
        </div>


        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" id="cancelBatchEditModalBtn" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors">Cancelar</button>
          <button type="submit" id="saveBatchEditBtn" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors">Guardar Cambios</button>
        </div>
      </form>
    </Modal>
  );
};


export default App;
