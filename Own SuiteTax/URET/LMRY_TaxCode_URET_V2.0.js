/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_TaxCode_URET_V2.0.js                        ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Aug 17 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 *@NModuleScope Public
 */
define(['N/log', 'N/runtime',
        './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0',
        './Latam_Library/LMRY_Log_LBRY_V2.0'
    ],

    function(log, runtime, Library_Mail, Library_Log) {

        var LMRY_SCRIPT = 'LMRY TaxCode URET 2.0';
        var LMRY_SCRIPT_NAME = 'LMRY_TaxCode_URET_V2.0.js';

        // FEATURES
        var ST_FEATURE = false;

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
         */
        function beforeLoad(scriptContext) {

        }

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {

            try {

                ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

                var newRecordObj = scriptContext.newRecord;
                var actionType = scriptContext.type;

                if (ST_FEATURE == true || ST_FEATURE == 'T') {

                    if (['create', 'edit', 'copy'].indexOf(actionType) != -1) {

                        var TC_TaxType = newRecordObj.getValue({ fieldId: 'taxtype' });
                        newRecordObj.setValue({ fieldId: 'custrecord_lmry_ste_setup_tax_type', value: TC_TaxType });
                    }

                }

            } catch (error) {
                Library_Mail.sendemail('[ beforeSubmit ]: ' + error, LMRY_SCRIPT);
                Library_Log.doLog({ title: '[ beforeSubmit ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
            }

        }

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {

        }

        return {
            // beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            // afterSubmit: afterSubmit
        };

    });