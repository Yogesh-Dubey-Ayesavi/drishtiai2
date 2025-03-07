import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label"

import { Input } from "@/components/ui/input";
import { getStoredPath, storePath } from '@/helpers/path_helpers';
import { calculateAge } from '@/helpers/file_helpers';
import { Patient } from '@/types/patient';
import { Search } from 'lucide-react';
import { getDatabasePaths } from '@/utils/path-helpers';

export default function HomePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [serverPath, setServerPath] = useState(() => getStoredPath() || "C:\\Mediview\\resources\\server");
  const navigate = useNavigate();
  
  useEffect(() => {
    try {
      // Check authentication
      const email = localStorage.getItem('email');
      const password = localStorage.getItem('password');

      if (!email || !password) {
        navigate('/');
        return;
      }

      loadPatients().catch(err => {
        setError(`Failed to load patients: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      });
    } catch (err) {
      setError(`Authentication error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    try {
      const filtered = patients.filter(patient => {
        if (!patient) return false;
        
        const searchLower = searchQuery.toLowerCase();
        return (
          (patient.firstname?.toLowerCase() || '').includes(searchLower) ||
          (patient.lastname?.toLowerCase() || '').includes(searchLower) ||
          (patient.pid?.toLowerCase() || '').includes(searchLower)
        );
      });
      setFilteredPatients(filtered);
    } catch (err) {
      console.error('Error filtering patients:', err);
      setFilteredPatients([]); // Reset to empty array on error
      setError(`Error filtering patients: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [searchQuery, patients]);

  // Add cleanup on component unmount
  useEffect(() => {
    return () => {
      setIsDialogOpen(false);
      setShowConfigDialog(false);
      setIsLoading(false);
    };
  }, []);

  const loadPatients = async () => {
    try {
      setIsLoading(true);
      const serverPath = getStoredPath();
      
      if (!serverPath) {
        setError('Server path not configured');
        return;
      }

      const dbPaths = getDatabasePaths();
      const { data, error: readError } = await window.electron.readJsonFile(dbPaths.patient);

      if (readError) {
        setError(`Failed to load patient data: ${readError}`);
        return;
      }

      // Sort patients by createdAt date in descending order (newest first)
      if (Array.isArray(data)) {
        console.log('Patient dates before sorting:', data.slice(0, 5).map(p => ({
          name: `${p.firstname} ${p.lastname}`,
          creationdate: p.creationdate,
          pid: p.pid
        })
      
      ));

        const sortedPatients = data.sort((a, b) => {
          const dateA = new Date(a.creationdate || 0);
          const dateB = new Date(b.creationdate || 0);
          return dateB.getTime() - dateA.getTime();
        });
    
  
        setPatients(sortedPatients);
        setFilteredPatients(sortedPatients);
        setError(null);
      } else {
        setError('Invalid patient data format');
      }
    } catch (err) {
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePathSave = () => {
    storePath(serverPath);
    setShowConfigDialog(false);
    loadPatients();
  };

  const handlePatientSelect = async (patientId: string, e: React.MouseEvent) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
   try {
    await navigate(`/patient/${patientId}`);
    // Add this line to force window focus
    await window.electron.focusWindow();
  } catch (error) {
    console.error('Navigation error:', error);
  } finally {
    setIsDialogOpen(false);
  }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="animate-spin">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <div className="text-destructive">{error}</div>
        <div className="flex gap-4">
          <Button onClick={() => loadPatients()}>Retry</Button>
          <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
            <DialogTrigger asChild>
              <Button>Configure</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Database Configuration</DialogTitle>
                <DialogDescription>
                  Configure the database server path for your application.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="serverPath">Server Path</Label>
                  <div className="flex gap-2">
                    <Input
                      id="serverPath"
                      value={serverPath}
                      onChange={(e) => setServerPath(e.target.value)}
                      placeholder="Enter the server path"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        const result = await window.electron.showOpenDialog({
                          properties: ['openDirectory'],
                          defaultPath: serverPath
                        });
                        
                        if (!result.canceled && result.filePaths.length > 0) {
                          setServerPath(result.filePaths[0]);
                        }
                      }}
                    >
                      Browse
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setServerPath("C:\\Mediview\\resources\\server")}
                >
                  Reset to Default
                </Button>
                <Button type="button" onClick={handlePathSave}>
                  Save Configuration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // Modify the Dialog components to have proper event handling
  return (
    <div className="flex flex-col h-full items-center justify-center p-6" 
    onClick={(e) => {
      e.preventDefault(); 
      e.stopPropagation();
    }}>
      <h1 className="text-4xl font-bold mb-4 select-none">Welcome</h1>
      
      <Button 
        size="lg"
        onClick={() => {
          setSearchQuery('');
          setIsDialogOpen(true);
        }}
      >
        Open Patient
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Patient</DialogTitle>
          </DialogHeader>
          
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or patient ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">First Name</TableHead>
                  <TableHead className="w-[200px]">Last Name</TableHead>
                  <TableHead className="w-[150px]">Patient ID</TableHead>
                  <TableHead className="w-[100px]">Gender</TableHead>
                  <TableHead className="w-[100px]">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow 
                    key={patient._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={(e) => handlePatientSelect(patient._id, e)}
                  >
                    <TableCell className="font-medium">{patient.firstname}</TableCell>
                    <TableCell>{patient.lastname}</TableCell>
                    <TableCell>{patient.pid}</TableCell>
                    <TableCell>{patient.sex}</TableCell>
                    <TableCell>{calculateAge(patient.birthday)}</TableCell>
                  </TableRow>
                ))}
                {filteredPatients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No patients found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
