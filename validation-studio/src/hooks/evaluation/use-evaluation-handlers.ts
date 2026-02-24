import { useCallback } from "react"
import { Configuration } from "@/types/configuration"
import { CookieManager } from "@/lib/configuration/cookie-manager"
import { EvaluationState } from "./types"

export function useEvaluationHandlers(state: EvaluationState, updateStepStatus: (id: string, status: any) => void) {
    const {
        setSelectedConfig,
        setCurrentPhase,
        configs,
        setConfigs,
        setIsConfigDialogOpen,
        setPerturbationConfig,
    } = state

    const handleConfigSelect = useCallback((config: Configuration) => {
        setSelectedConfig(config);
        console.log("Configuration selected:", config.name);

        updateStepStatus("config_wait", "success");
        updateStepStatus("strategy_wait", "loading");
        setCurrentPhase('perturbation_strategy');
    }, [setSelectedConfig, updateStepStatus, setCurrentPhase])

    const handleNewConfig = useCallback((newConfig: Configuration) => {
        const updatedConfigs = [...configs, newConfig];
        setConfigs(updatedConfigs);
        CookieManager.set("llm_configurations", JSON.stringify(updatedConfigs), { expires: 365 });
        setIsConfigDialogOpen(false);
        handleConfigSelect(newConfig);
    }, [configs, setConfigs, setIsConfigDialogOpen, handleConfigSelect])

    const handleStrategyConfirm = useCallback((config: any) => {
        console.log("Strategy Config:", config);
        setPerturbationConfig(config);
        updateStepStatus("strategy_wait", "success");
        setCurrentPhase('ready');
    }, [setPerturbationConfig, updateStepStatus, setCurrentPhase])

    return {
        handleConfigSelect,
        handleNewConfig,
        handleStrategyConfirm
    }
}
