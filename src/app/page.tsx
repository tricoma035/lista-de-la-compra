'use client';

import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from '@/components/ui/SearchBar';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient'; 
import { Product, SeccionUsuario } from '@/types'; 
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface SupabaseUserIntoleranceRow {
  intolerancia: { 
    nombre: string;
  }[] | null;
}

interface SupabaseUserExcludedIngredientRow {
  ingrediente: { 
    nombre_comun: string;
  }[] | null;
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  
  const [userSecciones, setUserSecciones] = useState<SeccionUsuario[]>([]);
  const [selectedSeccionId, setSelectedSeccionId] = useState<number | '' | null>('');
  const [loadingSecciones, setLoadingSecciones] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [userIntoleranceNames, setUserIntoleranceNames] = useState<string[]>([]);
  const [userExcludedIngredientNames, setUserExcludedIngredientNames] = useState<string[]>([]);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  const fetchUserSecciones = useCallback(async () => {
    if (!user) {
      setUserSecciones([]);
      setSelectedSeccionId('');
      return;
    }
    setLoadingSecciones(true);
    try {
      const { data, error } = await supabase
        .from('seccion_usuario')
        .select('*')
        .eq('user_id', user.id)
        .order('nombre_seccion', { ascending: true });
      if (error) throw error;
      setUserSecciones(data || []);
    } catch (err) {
      console.error("Error fetching user secciones:", err);
      setUserSecciones([]);
    } finally {
      setLoadingSecciones(false);
    }
  }, [user]);

  const fetchUserPreferencesForN8N = useCallback(async () => {
    if (!user) {
      setUserIntoleranceNames([]);
      setUserExcludedIngredientNames([]);
      return;
    }
    setLoadingPreferences(true);
    try {
      const { data: intolerancesData, error: intError } = await supabase
        .from('usuario_intolerancia')
        .select('intolerancia:intolerancia_id!inner(nombre)')
        .eq('user_id', user.id);
      if (intError) throw intError;
      
      const typedIntolerancesData = intolerancesData as SupabaseUserIntoleranceRow[] | null;
      setUserIntoleranceNames(
        typedIntolerancesData
          ?.map(item => item.intolerancia && item.intolerancia.length > 0 ? item.intolerancia[0]?.nombre : null)
          .filter(Boolean) as string[] 
        || []
      );

      const { data: excludedIngredientsData, error: ingError } = await supabase
        .from('usuario_ingrediente_excluido')
        .select('ingrediente:ingrediente_id!inner(nombre_comun)') 
        .eq('user_id', user.id);
      if (ingError) throw ingError;

      const typedExcludedIngredientsData = excludedIngredientsData as SupabaseUserExcludedIngredientRow[] | null;
      setUserExcludedIngredientNames(
        typedExcludedIngredientsData
          ?.map(item => item.ingrediente && item.ingrediente.length > 0 ? item.ingrediente[0]?.nombre_comun : null)
          .filter(Boolean) as string[] 
        || []
      );

    } catch (error) {
      console.error('Error fetching user preferences for N8N:', error);
      setUserIntoleranceNames([]);
      setUserExcludedIngredientNames([]);
    } finally {
      setLoadingPreferences(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserSecciones();
    if (user) {
      fetchUserPreferencesForN8N();
    } else {
      setUserIntoleranceNames([]);
      setUserExcludedIngredientNames([]);
    }
  }, [user, fetchUserSecciones, fetchUserPreferencesForN8N]);

  const handleSearchSubmit = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    setSearchError(null);
    setSearchResults([]);

    const selectedUserSeccion = userSecciones.find(s => s.id === selectedSeccionId);
    const supermarketName = selectedUserSeccion?.nombre_seccion || null;
    const interactionSessionId = crypto.randomUUID();

    try {
      const requestBody = {
        searchTerm,
        supermarketName,
        userId: user?.id || null,
        userIntolerances: userIntoleranceNames,
        userExcludedIngredients: userExcludedIngredientNames,
        interactionSessionId, 
      };

      const response = await fetch('/api/search-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido al procesar la respuesta de error de la API.' }));
        throw new Error(errorData.message || `Error ${response.status} de la API`);
      }
      
      const productsFromApi: Product[] = await response.json();
      
      setSearchResults(productsFromApi);
      if (productsFromApi.length === 0) {
        setSearchError('No se encontraron productos para tu búsqueda.' + (supermarketName ? ` En "${supermarketName}".` : ''));
      }

    } catch (err: any) {
      setSearchError(err.message || 'Ocurrió un error al buscar productos.');
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  if (authLoading) { 
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl text-[var(--color-text-muted)]">Cargando aplicación...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen">
      <div className="text-center mb-12">
        <h1 className="page-main-title font-black tracking-tighter text-[var(--color-primary-accent)] animate-fade-in-down">
          Buscador Inteligente <span className="block sm:inline text-[var(--color-secondary-accent)]">de Productos</span>
        </h1>
        <p className="text-xl text-[var(--color-text-muted)] max-w-3xl mx-auto mt-4 animate-fade-in-up">
          {user ? 'Selecciona tu tienda y encuentra productos usando IA. Consideraremos tus preferencias guardadas.' : 'Inicia sesión para una experiencia personalizada y guardar tus preferencias.'}
        </p>
        {user && (userIntoleranceNames.length > 0 || userExcludedIngredientNames.length > 0 || loadingPreferences) && (
          <div className="mt-5 text-sm text-green-800 bg-green-100/70 backdrop-blur-sm p-4 rounded-2xl inline-block shadow-md max-w-xl mx-auto transition-all-smooth hover:shadow-lg">
            {loadingPreferences ? 'Cargando tus preferencias...' : 
             <>
                {userIntoleranceNames.length > 0 && <p><strong className="font-semibold">Intolerancias:</strong> {userIntoleranceNames.join(', ')}</p>}
                {userExcludedIngredientNames.length > 0 && <p className={userIntoleranceNames.length > 0 ? 'mt-1' : ''}><strong className="font-semibold">Excluidos:</strong> {userExcludedIngredientNames.join(', ')}</p>}
                {(userIntoleranceNames.length === 0 && userExcludedIngredientNames.length === 0 && !loadingPreferences) && <p>No tienes preferencias configuradas.</p>}
             </>
            }
          </div>
        )}
      </div>

      {user && (
        <div className="max-w-2xl mx-auto mb-10 p-6 md:p-8 card-style animate-slide-in-up">
          <div className="mb-5">
            <label htmlFor="seccion-select" className="block text-sm font-semibold text-[var(--color-text-base)] mb-1">Selecciona tu Tienda:</label>
            {loadingSecciones ? <p className="text-sm text-[var(--color-text-muted)]">Cargando tus tiendas...</p> : 
             userSecciones.length > 0 ? (
                <select 
                  id="seccion-select"
                  value={selectedSeccionId || ''}
                  onChange={(e) => setSelectedSeccionId(e.target.value ? parseInt(e.target.value) : '')}
                  className="mt-1 block w-full p-3 border border-gray-300/70 bg-white/90 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-accent)] focus:border-[var(--color-primary-accent)] sm:text-sm transition-all-smooth"
                >
                  <option value="">-- Búsqueda Global --</option>
                  {userSecciones.map(seccion => (
                    <option key={seccion.id} value={seccion.id}>{seccion.nombre_seccion}</option>
                  ))}
                </select>
             ) : (
                <div className="text-sm text-teal-700 p-3 bg-teal-50/80 border border-teal-200/90 rounded-xl transition-all-smooth hover:bg-teal-100/80">
                    No has creado ninguna sección. 
                    <Link href="/mis-secciones" className="font-semibold text-[var(--color-primary-accent)] hover:text-[var(--color-primary-accent-hover)]"> Crea una ahora</Link>.
                </div>
             )
            }
          </div>
          <SearchBar 
            searchTerm={searchTerm} 
            onSearchTermChange={setSearchTerm} 
            onSearchSubmit={handleSearchSubmit} 
            isLoading={loadingSearch} 
            placeholder={
              userSecciones.find(s => s.id === selectedSeccionId)?.nombre_seccion 
                ? `Buscar en ${userSecciones.find(s => s.id === selectedSeccionId)?.nombre_seccion}...` 
                : "Buscar producto (ej: Leche de avena sin lactosa)"
            }
          />
        </div>
      )}
      {!user && (
          <div className="text-center max-w-md mx-auto p-6 md:p-8 card-style animate-slide-in-up">
              <p className="text-[var(--color-text-muted)] mb-5 text-lg">Conéctate para disfrutar de todas las funcionalidades.</p>
              <Link href="/auth/login" passHref>
                <Button className="button-primary text-base">
                  Iniciar Sesión
                </Button>
              </Link>
          </div>
      )}

      {searchError && (
        <div role="alert" className="my-6 p-4 bg-red-100/70 border border-red-400/80 text-red-700 rounded-xl text-center shadow-md transition-all-smooth animate-fade-in">
          <p>{searchError}</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="mt-12 animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-title-main)] mb-8 text-center">Resultados</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
            {searchResults.map((product, index) => (
                <div 
                  key={product.id} 
                  className="card-style flex flex-col group animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                {product.imagen_url ? (
                    <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-t-2xl bg-gray-100">
                    <img src={product.imagen_url} alt={product.nombre} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"/>
                    </div>
                ) : (
                    <div className="w-full h-48 bg-gray-200/50 flex items-center justify-center text-gray-500 rounded-t-2xl">
                    Sin imagen
                    </div>
                )}
                <div className="p-5 flex flex-col flex-grow">
                    <h3 className="text-lg font-semibold text-[var(--color-text-base)] mb-1 truncate group-hover:text-[var(--color-primary-accent)] transition-all-smooth" title={product.nombre}>{product.nombre}</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-3 truncate" title={product.marca}>{product.marca || 'Marca no disponible'}</p>
                    <div className="mt-auto pt-3 border-t border-[var(--color-card-border)]/[0.5]">
                    <Link href={`/product/${product.id}`} passHref>
                        <Button className="w-full button-secondary text-sm">
                            Ver Detalles
                        </Button>
                    </Link>
                    </div>
                </div>
                </div>
            ))}
            </div>
        </div>
      )}
      
      {!loadingSearch && searchResults.length === 0 && !searchError && searchTerm && (
         <div className="text-center text-[var(--color-text-muted)] mt-10 py-8 animate-fade-in">
            <svg className="mx-auto h-12 w-12 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            <h3 className="mt-2 text-lg font-medium text-[var(--color-text-base)]">Sin resultados</h3>
            <p className="mt-1 text-sm">No se encontraron productos para "{searchTerm}"{userSecciones.find(s=>s.id === selectedSeccionId) ? ` en "${userSecciones.find(s=>s.id === selectedSeccionId)?.nombre_seccion}"` : ''}. Prueba con otros términos.</p>
         </div>
      )}

    </div>
  );
}
