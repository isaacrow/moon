import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Settings, 
  User, 
  Database, 
  Bell, 
  Shield,
  FileText,
  Palette,
  Globe,
  Save,
  RotateCcw
} from 'lucide-react';
import { Separator } from './ui/separator';

interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { t, i18n } = useTranslation();
  
  // General Settings
  const [autoSave, setAutoSave] = useState(true);
  const [saveInterval, setSaveInterval] = useState('5');
  const [defaultView, setDefaultView] = useState('catalog');
  
  // Display Settings
  const [theme, setTheme] = useState('system');
  const [fontSize, setFontSize] = useState('medium');
  const [compactMode, setCompactMode] = useState(false);
  
  // Cataloging Settings
  const [defaultResourceType, setDefaultResourceType] = useState('monograph');
  const [validateOnSave, setValidateOnSave] = useState(true);
  const [requireWorkBeforeInstance, setRequireWorkBeforeInstance] = useState(true);
  
  // Authority Settings
  const [preferredAuthority, setPreferredAuthority] = useState('naf');
  const [autoLink, setAutoLink] = useState(true);
  const [showURIs, setShowURIs] = useState(true);
  
  // Data Import/Export
  const [defaultExportFormat, setDefaultExportFormat] = useState('jsonld');
  const [includeContext, setIncludeContext] = useState(true);
  const [prettyPrint, setPrettyPrint] = useState(true);

  const handleSaveSettings = () => {
    // Save settings logic
    console.log('Saving settings...');
  };

  const handleResetSettings = () => {
    // Reset to defaults
    setAutoSave(true);
    setSaveInterval('5');
    setDefaultView('catalog');
    setTheme('system');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Settings
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure your Moon BIBFRAME Editor preferences
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleResetSettings}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSaveSettings}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">
                <Settings className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="display">
                <Palette className="h-4 w-4 mr-2" />
                Display
              </TabsTrigger>
              <TabsTrigger value="cataloging">
                <FileText className="h-4 w-4 mr-2" />
                Cataloging
              </TabsTrigger>
              <TabsTrigger value="authority">
                <Database className="h-4 w-4 mr-2" />
                Authority
              </TabsTrigger>
              <TabsTrigger value="import-export">
                <Globe className="h-4 w-4 mr-2" />
                Import/Export
              </TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>General Preferences</CardTitle>
                  <CardDescription>
                    Configure basic application behavior
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-save</Label>
                      <p className="text-sm text-gray-500">
                        Automatically save changes while editing
                      </p>
                    </div>
                    <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                  </div>

                  {autoSave && (
                    <div>
                      <Label>Auto-save Interval (minutes)</Label>
                      <Select value={saveInterval} onValueChange={setSaveInterval}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 minute</SelectItem>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="10">10 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Separator />

                  <div>
                    <Label>Default View</Label>
                    <Select value={defaultView} onValueChange={setDefaultView}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="catalog">Catalog Editor</SelectItem>
                        <SelectItem value="search">Search</SelectItem>
                        <SelectItem value="opac">OPAC View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Language</Label>
                    <Select
                      value={i18n.language}
                      onValueChange={(lang) => {
                        i18n.changeLanguage(lang);
                        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ar">العربية (Arabic)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Display Settings */}
            <TabsContent value="display" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Display Preferences</CardTitle>
                  <CardDescription>
                    Customize the appearance of the editor
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Theme</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Font Size</Label>
                    <Select value={fontSize} onValueChange={setFontSize}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                        <SelectItem value="xlarge">Extra Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Compact Mode</Label>
                      <p className="text-sm text-gray-500">
                        Reduce spacing between elements
                      </p>
                    </div>
                    <Switch checked={compactMode} onCheckedChange={setCompactMode} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cataloging Settings */}
            <TabsContent value="cataloging" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cataloging Preferences</CardTitle>
                  <CardDescription>
                    Configure BIBFRAME cataloging behavior
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Default Resource Type</Label>
                    <Select value={defaultResourceType} onValueChange={setDefaultResourceType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monograph">Monograph</SelectItem>
                        <SelectItem value="serial">Serial</SelectItem>
                        <SelectItem value="music">Notated Music</SelectItem>
                        <SelectItem value="moving-image">Moving Image</SelectItem>
                        <SelectItem value="audio">Audio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Validate on Save</Label>
                      <p className="text-sm text-gray-500">
                        Check for errors before saving records
                      </p>
                    </div>
                    <Switch checked={validateOnSave} onCheckedChange={setValidateOnSave} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require Work Before Instance</Label>
                      <p className="text-sm text-gray-500">
                        Enforce Work creation before Instance
                      </p>
                    </div>
                    <Switch
                      checked={requireWorkBeforeInstance}
                      onCheckedChange={setRequireWorkBeforeInstance}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Authority Settings */}
            <TabsContent value="authority" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Authority Control</CardTitle>
                  <CardDescription>
                    Configure authority file preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Preferred Authority Source</Label>
                    <Select value={preferredAuthority} onValueChange={setPreferredAuthority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="naf">LC Name Authority File (NAF)</SelectItem>
                        <SelectItem value="viaf">VIAF</SelectItem>
                        <SelectItem value="wikidata">Wikidata</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-link Authorities</Label>
                      <p className="text-sm text-gray-500">
                        Automatically link to authority records
                      </p>
                    </div>
                    <Switch checked={autoLink} onCheckedChange={setAutoLink} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Show URIs</Label>
                      <p className="text-sm text-gray-500">
                        Display full URIs for linked authorities
                      </p>
                    </div>
                    <Switch checked={showURIs} onCheckedChange={setShowURIs} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Import/Export Settings */}
            <TabsContent value="import-export" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Import/Export Preferences</CardTitle>
                  <CardDescription>
                    Configure data exchange settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Default Export Format</Label>
                    <Select value={defaultExportFormat} onValueChange={setDefaultExportFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jsonld">JSON-LD</SelectItem>
                        <SelectItem value="rdfxml">RDF/XML</SelectItem>
                        <SelectItem value="turtle">Turtle</SelectItem>
                        <SelectItem value="ntriples">N-Triples</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Include @context</Label>
                      <p className="text-sm text-gray-500">
                        Include JSON-LD context in exports
                      </p>
                    </div>
                    <Switch checked={includeContext} onCheckedChange={setIncludeContext} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Pretty Print</Label>
                      <p className="text-sm text-gray-500">
                        Format exported JSON with indentation
                      </p>
                    </div>
                    <Switch checked={prettyPrint} onCheckedChange={setPrettyPrint} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
