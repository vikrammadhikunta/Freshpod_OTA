import React, { useState, useCallback } from "react";
import axios from "axios";
import {
  Upload,
  File as FileIcon,
  CheckCircle,
  AlertCircle,
  X,
  Loader,
  Info,
  Cpu,
  HardDrive,
  IndianRupee
} from "lucide-react";

export default function App() {

  const [form, setForm] = useState({
    machineId: "",
    machineName: "",
    amount: ""
  });

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setUploadStatus(null);
  };

  const handleFileChange = (selectedFile) => {

    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".bin")) {
      alert("Please select a .bin file");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert("File size should be less than 10MB");
      return;
    }

    setFile(selectedFile);
    setUploadStatus(null);
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    handleFileChange(droppedFile);
  }, []);

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!file) {
      alert("Please select firmware file");
      return;
    }

    const formData = new FormData();

    formData.append("machineId", form.machineId);
    formData.append("machineName", form.machineName);
    formData.append("amount", form.amount);
    formData.append("file", file);

    try {

      setLoading(true);
      setUploadProgress(0);
      setUploadStatus(null);

      const res = await axios.post(`https://freshpod-ota-r3b9.onrender.com/add`, formData, {

        onUploadProgress: (progressEvent) => {

          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );

          setUploadProgress(percentCompleted);
        },
      });

      console.log(res.data);

      setUploadStatus("success");

      setTimeout(() => {

        setForm({
          machineId: "",
          machineName: "",
          amount: ""
        });

        setFile(null);
        setUploadProgress(0);

      }, 2000);

    } catch (err) {

      console.error(err);

      if (err.response) {
        alert(err.response.data.message);
      }

      setUploadStatus("error");

    } finally {

      setLoading(false);

    }
  };

  const clearFile = () => {
    setFile(null);
    setUploadStatus(null);
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.container}>

        <div style={styles.header}>
          <Cpu size={32} color="white" />
          <h2 style={styles.title}>Firmware Upload Portal</h2>
          <p style={styles.subtitle}>Upload machine firmware</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Machine Information</h3>

            <div style={styles.inputGroup}>
              <div style={styles.inputIcon}>
                <HardDrive size={18} color="#6b7280" />
              </div>

              <input
                name="machineId"
                placeholder="Machine ID"
                value={form.machineId}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <div style={styles.inputIcon}>
                <Cpu size={18} color="#6b7280" />
              </div>

              <input
                name="machineName"
                placeholder="Machine Name"
                value={form.machineName}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <div style={styles.inputIcon}>
                <IndianRupee size={18} color="#6b7280" />
              </div>

              <select
                name="amount"
                value={form.amount}
                onChange={handleChange}
                style={styles.input}
                required
              >
                <option value="" disabled>Select Amount (₹)</option>
                <option value="1"> 1</option>
                <option value="59"> 59</option>
                <option value="99"> 99</option>
              </select>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Firmware File</h3>

            <div
              style={{
                ...styles.dropZone,
                ...(dragActive ? styles.dropZoneActive : {}),
                ...(file ? styles.dropZoneFilled : {})
              }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >

              {!file ? (

                <div style={styles.dropZoneContent}>
                  <Upload size={32} color="#6b7280" />
                  <p style={styles.dropZoneText}>Drag & drop .bin file</p>

                  <label style={styles.browseButton}>
                    Browse
                    <input
                      type="file"
                      accept=".bin"
                      onChange={(e) => handleFileChange(e.target.files[0])}
                      hidden
                    />
                  </label>
                </div>

              ) : (

                <div style={styles.fileInfo}>
                  <FileIcon size={24} color="#4f46e5" />

                  <div style={styles.fileDetails}>
                    <p style={styles.fileName}>{file.name}</p>
                    <p style={styles.fileSize}>
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={clearFile}
                    style={styles.clearButton}
                  >
                    <X size={18} />
                  </button>
                </div>

              )}

            </div>

            <div style={styles.fileRequirements}>
              <Info size={14} />
              <span>Max file size 10MB (.bin only)</span>
            </div>
          </div>

          {loading && (
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${uploadProgress}%`
                  }}
                />
              </div>

              <p style={styles.progressText}>
                Uploading {uploadProgress}%
              </p>
            </div>
          )}

          {uploadStatus === "success" && (
            <div style={styles.successMessage}>
              <CheckCircle size={20} />
              Firmware uploaded successfully
            </div>
          )}

          {uploadStatus === "error" && (
            <div style={styles.errorMessage}>
              <AlertCircle size={20} />
              Upload failed
            </div>
          )}

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
            disabled={loading}
          >

            {loading ? (
              <>
                <Loader size={20} style={styles.spinner} />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={20} />
                Upload Firmware
              </>
            )}

          </button>

        </form>

      </div>
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  container: {
    maxWidth: 550,
    width: '100%',
    margin: '0 auto',
    background: 'white',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    color: 'white',
    padding: '30px',
    textAlign: 'center',
  },
  title: {
    margin: '10px 0 5px',
    fontSize: '24px',
    fontWeight: '600',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    opacity: 0.9,
  },
  form: {
    padding: '30px',
  },
  section: {
    marginBottom: '25px',
  },
  sectionTitle: {
    margin: '0 0 15px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
  },
  inputGroup: {
    position: 'relative',
    marginBottom: '12px',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 12px 12px 40px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
    backgroundColor: 'white',
    appearance: 'none',
  },
  dropZone: {
    border: '2px dashed #e5e7eb',
    borderRadius: '8px',
    padding: '30px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backgroundColor: '#f9fafb',
  },
  dropZoneActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  dropZoneFilled: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  dropZoneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  dropZoneText: {
    margin: 0,
    fontSize: '16px',
    color: '#374151',
  },
  browseButton: {
    padding: '8px 16px',
    backgroundColor: '#4f46e5',
    color: 'white',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    transition: 'background-color 0.2s',
    display: 'inline-block',
    ':hover': {
      backgroundColor: '#4338ca',
    },
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fileDetails: {
    flex: 1,
    textAlign: 'left',
  },
  fileName: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  fileSize: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: '#6b7280',
  },
  clearButton: {
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    transition: 'color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      color: '#ef4444',
    },
  },
  fileRequirements: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    fontSize: '12px',
    color: '#9ca3af',
  },
  progressContainer: {
    margin: '20px 0',
  },
  progressBar: {
    width: '100%',
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
    transition: 'width 0.3s ease',
  },
  progressText: {
    margin: '8px 0 0',
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '20px',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
  successMessage: {
    padding: '12px',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    marginBottom: '15px',
  },
  errorMessage: {
    padding: '12px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    marginBottom: '15px',
  },
};

// Add this to your global CSS or style tag
const globalStyles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  input:focus, select:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }
  
  button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  }
  
  label:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2);
  }
`;

// Inject global styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = globalStyles;
  document.head.appendChild(style);
}