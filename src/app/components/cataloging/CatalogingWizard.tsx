/**
 * Cataloging Wizard - Step-by-step BIBFRAME record creation
 * Professional interface for catalogers
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Check, AlertCircle, BookOpen, Package, Building2, Archive } from 'lucide-react';

export type WizardStep = 'work' | 'instance' | 'publication' | 'item';

interface CatalogingWizardProps {
  currentStep: WizardStep;
  onStepChange: (step: WizardStep) => void;
  validation: {
    work: boolean;
    instance: boolean;
    publication: boolean;
    item: boolean;
  };
  children: React.ReactNode;
}

export function CatalogingWizard({
  currentStep,
  onStepChange,
  validation,
  children
}: CatalogingWizardProps) {
  const steps: Array<{ id: WizardStep; label: string; icon: any; description: string }> = [
    { id: 'work', label: 'Work', icon: BookOpen, description: 'Intellectual content' },
    { id: 'instance', label: 'Instance', icon: Package, description: 'Physical/digital manifestation' },
    { id: 'publication', label: 'Publication', icon: Building2, description: 'Publication details' },
    { id: 'item', label: 'Item', icon: Archive, description: 'Holdings (optional)' }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const canGoNext = () => {
    switch (currentStep) {
      case 'work':
        return validation.work;
      case 'instance':
        return validation.instance;
      case 'publication':
        return validation.publication;
      case 'item':
        return true; // Always can finish from item
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1 && canGoNext()) {
      onStepChange(steps[currentStepIndex + 1].id);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      onStepChange(steps[currentStepIndex - 1].id);
    }
  };

  const getStepStatus = (stepId: WizardStep): 'complete' | 'current' | 'incomplete' | 'future' => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    
    if (stepIndex < currentStepIndex) {
      return validation[stepId] ? 'complete' : 'incomplete';
    } else if (stepIndex === currentStepIndex) {
      return 'current';
    } else {
      return 'future';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => onStepChange(step.id)}
                  className={`flex flex-col items-center gap-2 min-w-[120px] transition-all ${
                    status === 'current' ? 'scale-105' : ''
                  }`}
                  type="button"
                >
                  {/* Icon Circle */}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    status === 'complete' ? 'bg-green-500 text-white' :
                    status === 'current' ? 'bg-blue-500 text-white shadow-lg' :
                    status === 'incomplete' ? 'bg-red-100 text-red-500 border-2 border-red-300' :
                    'bg-gray-200 text-gray-400'
                  }`}>
                    {status === 'complete' ? (
                      <Check className="h-7 w-7" />
                    ) : status === 'incomplete' ? (
                      <AlertCircle className="h-7 w-7" />
                    ) : (
                      <Icon className="h-7 w-7" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="text-center">
                    <div className={`font-semibold ${
                      status === 'current' ? 'text-blue-600 text-lg' :
                      status === 'complete' ? 'text-green-600' :
                      status === 'incomplete' ? 'text-red-500' :
                      'text-gray-500'
                    }`}>
                      {step.label}
                    </div>
                    <div className={`text-xs mt-1 ${
                      status === 'current' ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {step.description}
                    </div>
                  </div>
                </button>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className={`h-1 flex-1 mx-4 rounded transition-all ${
                    getStepStatus(steps[index + 1].id) === 'complete' || 
                    getStepStatus(steps[index + 1].id) === 'current'
                      ? 'bg-blue-500'
                      : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm min-h-[500px]">
        {children}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <button
          onClick={handlePrevious}
          disabled={currentStepIndex === 0}
          className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
            currentStepIndex === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
          Previous
        </button>

        <div className="text-sm text-gray-600 font-medium">
          Step {currentStepIndex + 1} of {steps.length}
        </div>

        {currentStepIndex < steps.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canGoNext()}
            className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
              canGoNext()
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            type="button"
          >
            Next
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-[120px]"></div>
        )}
      </div>
    </div>
  );
}
