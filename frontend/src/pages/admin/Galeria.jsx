/**
 * Galeria Management Page - Boy Happy
 *
 * Comprehensive production-ready page for managing gallery images.
 * Implements full CRUD operations with React Query, UI components, and best practices.
 *
 * Features:
 * - View all images organized by albums
 * - Upload new images with album selection
 * - Create new albums
 * - Delete images
 * - Filter by album
 * - Preview images in modal
 * - Statistics dashboard
 * - Loading and error states
 * - Optimistic updates
 * - Responsive grid layout
 */

import { useState, useMemo, useRef } from 'react';
import { useGaleria } from '../../hooks/useGaleria';
import {
  SectionHeader,
  ActionBar,
  FilterPanel,
  EmptyStateCard,
  StatCardGrid
} from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import Swal from 'sweetalert2';
import { getApiConfig } from '../../stores/configStore';
import useAuthStore from '../../stores/authStore';

const { baseURL: API_URL } = getApiConfig();

/**
 * AlbumBadge - Badge for album category
 */
function AlbumBadge({ album }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: '#667eea20',
        color: '#667eea',
      }}
    >
      <i className="fas fa-folder"></i>
      {album}
    </span>
  );
}

/**
 * ImageCard - Card component for displaying gallery images
 */
function ImageCard({ image, onDelete, onPreview }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: '¿Eliminar imagen?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e53e3e',
      cancelButtonColor: '#718096',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      setIsDeleting(true);
      try {
        await onDelete(image.key);
      } catch (error) {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: 'white',
        transition: 'all 0.3s ease',
        opacity: isDeleting ? 0.5 : 1,
        pointerEvents: isDeleting ? 'none' : 'auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        onClick={() => onPreview(image)}
        style={{
          position: 'relative',
          paddingTop: '75%',
          backgroundColor: '#f7fafc',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        <img
          src={image.url}
          alt={image.descripcion || 'Imagen de galería'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          loading="lazy"
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.3s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0)';
          }}
        >
          <i
            className="fas fa-search-plus"
            style={{
              color: 'white',
              fontSize: '24px',
              opacity: 0,
              transition: 'opacity 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = 1;
            }}
          ></i>
        </div>
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ marginBottom: '8px' }}>
          <AlbumBadge album={image.album} />
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#718096',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <i className="fas fa-calendar"></i>
          {formatDate(image.lastModified)}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#718096',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <i className="fas fa-hdd"></i>
          {(image.size / 1024).toFixed(2)} KB
        </div>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#e53e3e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.3s',
            opacity: isDeleting ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isDeleting) e.currentTarget.style.backgroundColor = '#c53030';
          }}
          onMouseLeave={(e) => {
            if (!isDeleting) e.currentTarget.style.backgroundColor = '#e53e3e';
          }}
        >
          {isDeleting ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> Eliminando...
            </>
          ) : (
            <>
              <i className="fas fa-trash"></i> Eliminar
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function Galeria() {
  const { data: galeriaData, isLoading, refetch } = useGaleria();
  const token = useAuthStore((state) => state.token);

  const galleryImages = galeriaData?.images || [];
  const albums = galeriaData?.albums || [];

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState('todos');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    imageFile: null,
    imagePreview: null,
    album: '',
    newAlbum: '',
    useNewAlbum: false,
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Filtered images
  const filteredImages = useMemo(() => {
    return galleryImages.filter((image) => {
      const matchesAlbum =
        selectedAlbum === 'todos' || image.album === selectedAlbum;
      const matchesSearch =
        searchTerm === '' ||
        image.album.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesAlbum && matchesSearch;
    });
  }, [galleryImages, selectedAlbum, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const totalSize = galleryImages.reduce((sum, img) => sum + img.size, 0);
    return [
      {
        title: 'Total Imágenes',
        value: galleryImages.length,
        icon: 'fa-images',
        color: '#667eea',
      },
      {
        title: 'Álbumes',
        value: albums.length,
        icon: 'fa-folder',
        color: '#48bb78',
      },
      {
        title: 'Tamaño Total',
        value: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
        icon: 'fa-hdd',
        color: '#ed8936',
      },
      {
        title: 'Filtradas',
        value: filteredImages.length,
        icon: 'fa-filter',
        color: '#4299e1',
      },
    ];
  }, [galleryImages, albums, filteredImages]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Por favor selecciona un archivo de imagen válido',
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadForm({
          ...uploadForm,
          imageFile: file,
          imagePreview: reader.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle upload
  const handleUpload = async (e) => {
    e.preventDefault();

    const finalAlbum = uploadForm.useNewAlbum
      ? uploadForm.newAlbum.trim()
      : uploadForm.album;

    if (!uploadForm.imageFile) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor selecciona una imagen',
      });
      return;
    }

    if (!finalAlbum) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor selecciona o crea un álbum',
      });
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result;

        const response = await fetch(`${API_URL}/api/images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            imageName: uploadForm.imageFile.name,
            imageData: imageData,
            grupo: 'public',
            album: finalAlbum,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          await Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: 'Imagen subida exitosamente',
          });
          setShowUploadModal(false);
          setUploadForm({
            imageFile: null,
            imagePreview: null,
            album: '',
            newAlbum: '',
            useNewAlbum: false,
          });
          refetch();
        } else {
          throw new Error(data.message || 'Error al subir la imagen');
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(uploadForm.imageFile);
    } catch (error) {
      setIsUploading(false);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Error al subir la imagen',
      });
    }
  };

  // Handle delete
  const handleDelete = async (key) => {
    try {
      const response = await fetch(`${API_URL}/api/images`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key }),
      });

      const data = await response.json();

      if (response.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Éxito',
          text: 'Imagen eliminada exitosamente',
          timer: 1500,
          showConfirmButton: false,
        });
        refetch();
      } else {
        throw new Error(data.message || 'Error al eliminar la imagen');
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Error al eliminar la imagen',
      });
    }
  };

  // Handle preview
  const handlePreview = (image) => {
    setPreviewImage(image);
    setShowPreviewModal(true);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <SectionHeader
        title="Gestión de Galería"
        subtitle="Administra las imágenes de la galería pública"
        icon="fa-images"
      />

      {/* Statistics */}
      <StatCardGrid stats={stats} />

      {/* Action Bar */}
      <ActionBar
        searchPlaceholder="Buscar por álbum..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onAdd={() => setShowUploadModal(true)}
        addButtonText="Subir Imagen"
        addButtonIcon="fa-upload"
      />

      {/* Filters */}
      <FilterPanel>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedAlbum('todos')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: selectedAlbum === 'todos' ? '#667eea' : 'white',
              color: selectedAlbum === 'todos' ? 'white' : '#4a5568',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.3s',
            }}
          >
            Todos ({galleryImages.length})
          </button>
          {albums.map((album) => (
            <button
              key={album}
              onClick={() => setSelectedAlbum(album)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: selectedAlbum === album ? '#667eea' : 'white',
                color: selectedAlbum === album ? 'white' : '#4a5568',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.3s',
              }}
            >
              {album} ({galleryImages.filter((img) => img.album === album).length})
            </button>
          ))}
        </div>
      </FilterPanel>

      {/* Images Grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i
            className="fas fa-spinner fa-spin"
            style={{ fontSize: '48px', color: '#667eea', marginBottom: '16px' }}
          ></i>
          <p style={{ fontSize: '16px', color: '#718096' }}>Cargando galería...</p>
        </div>
      ) : filteredImages.length === 0 ? (
        <EmptyStateCard
          icon="fa-images"
          title="No hay imágenes"
          message={
            searchTerm || selectedAlbum !== 'todos'
              ? 'No se encontraron imágenes con los filtros seleccionados'
              : 'No hay imágenes en la galería. Comienza subiendo tu primera imagen.'
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px',
            marginTop: '24px',
          }}
        >
          {filteredImages.map((image) => (
            <ImageCard
              key={image.key}
              image={image}
              onDelete={handleDelete}
              onPreview={handlePreview}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => !isUploading && setShowUploadModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
              }}
            >
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#2d3748' }}>
                <i className="fas fa-upload" style={{ marginRight: '12px' }}></i>
                Subir Imagen
              </h2>
              <button
                onClick={() => !isUploading && setShowUploadModal(false)}
                disabled={isUploading}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#a0aec0',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpload}>
              {/* Image Preview */}
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #cbd5e0',
                  borderRadius: '12px',
                  padding: '40px',
                  textAlign: 'center',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  marginBottom: '24px',
                  backgroundColor: '#f7fafc',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={(e) => {
                  if (!isUploading) {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.backgroundColor = '#edf2f7';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isUploading) {
                    e.currentTarget.style.borderColor = '#cbd5e0';
                    e.currentTarget.style.backgroundColor = '#f7fafc';
                  }
                }}
              >
                {uploadForm.imagePreview ? (
                  <img
                    src={uploadForm.imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '200px',
                      borderRadius: '8px',
                    }}
                  />
                ) : (
                  <>
                    <i
                      className="fas fa-cloud-upload-alt"
                      style={{ fontSize: '48px', color: '#a0aec0', marginBottom: '16px' }}
                    ></i>
                    <p style={{ color: '#718096', fontSize: '14px' }}>
                      Haz clic para seleccionar una imagen
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploading}
                style={{ display: 'none' }}
              />

              {/* Album Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#2d3748',
                  }}
                >
                  <i className="fas fa-folder" style={{ marginRight: '8px' }}></i>
                  Álbum
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setUploadForm({ ...uploadForm, useNewAlbum: false })
                    }
                    disabled={isUploading}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: !uploadForm.useNewAlbum ? '#667eea' : 'white',
                      color: !uploadForm.useNewAlbum ? 'white' : '#4a5568',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    Álbum Existente
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setUploadForm({ ...uploadForm, useNewAlbum: true })
                    }
                    disabled={isUploading}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: uploadForm.useNewAlbum ? '#667eea' : 'white',
                      color: uploadForm.useNewAlbum ? 'white' : '#4a5568',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    Nuevo Álbum
                  </button>
                </div>

                {uploadForm.useNewAlbum ? (
                  <input
                    type="text"
                    value={uploadForm.newAlbum}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, newAlbum: e.target.value })
                    }
                    placeholder="Nombre del nuevo álbum"
                    disabled={isUploading}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px',
                    }}
                  />
                ) : (
                  <select
                    value={uploadForm.album}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, album: e.target.value })
                    }
                    disabled={isUploading}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="">Seleccionar álbum...</option>
                    {albums.map((album) => (
                      <option key={album} value={album}>
                        {album}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: '#4a5568',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#667eea',
                    color: 'white',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: isUploading ? 0.6 : 1,
                  }}
                >
                  {isUploading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Subiendo...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-upload"></i> Subir
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#2d3748' }}>
                <AlbumBadge album={previewImage.album} />
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#a0aec0',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                }}
              >
                ×
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.descripcion || 'Preview'}
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '8px',
              }}
            />
            <div style={{ marginTop: '16px', fontSize: '14px', color: '#718096' }}>
              <p>
                <i className="fas fa-calendar"></i> {formatDate(previewImage.lastModified)}
              </p>
              <p>
                <i className="fas fa-hdd"></i> {(previewImage.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
