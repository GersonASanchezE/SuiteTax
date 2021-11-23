/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_ST_Transaction_ConfigFields_LBRY_2.0.js     ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 07 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/log', 'N/search', 'N/record',
        './LMRY_libSendingEmailsLBRY_V2.0',
        './LMRY_Log_LBRY_V2.0'
    ],

    function(log, search, record, Library_Mail, Library_Log) {

        var LMRY_SCRIPT = 'LMRY ST Transaction Config Fields LBRY V2.0';
        var LMRY_SCRIPT_NAME = 'LMRY_ST_Transaction_ConfigFields_LBRY_2.0.js ';

        function setInvoicingIdentifier(recordObj) {

            try {

                var taxCodeByInvIdent = '';

                if (recordObj.type == 'invoice' || recordObj.type == 'creditmemo' || recordObj.type == 'vendorbill' || recordObj.type == 'vendorcredit') {

                    taxCodeByInvIdent = recordObj.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_taxcode_by_inv_ident' });

                    if (taxCodeByInvIdent != null && taxCodeByInvIdent != '' ) {

                        var customSearch = search.lookupFields({
                            type: 'customrecord_lmry_ste_tc_by_inv_ident',
                            id: taxCodeByInvIdent,
                            columns: [
                                'custrecord_lmry_ste_invoicing_id',
                                'custrecord_lmry_ste_invoicing_id_code'
                            ]
                        });

                        recordObj.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_lmry_invoicing_id',
                            value: customSearch.custrecord_lmry_ste_invoicing_id[0].value,
                            ignoreFieldChange: true
                        });
                        recordObj.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_lmry_invoicing_id_code',
                            value: customSearch.custrecord_lmry_ste_invoicing_id_code,
                            ignoreFieldChange: true
                        });

                        var FactorType = search.lookupFields({
                            type: 'customrecord_lmry_invoicing_id',
                            id: customSearch.custrecord_lmry_ste_invoicing_id[0].value,
                            columns: [
                                'custrecord_lmry_mx_tipo_factor'
                            ]
                        });

                        if( FactorType != null && FactorType.custrecord_lmry_mx_tipo_factor.length > 0 ) {
                            recordObj.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_lmry_mx_tipo_factor',
                                value: FactorType.custrecord_lmry_mx_tipo_factor[0].text,
                                ignoreFieldChange: true
                            });
                        }

                    }

                }

                if (recordObj.type == 'vendorbill' || recordObj.type == 'vendorcredit' || recordObj.type == 'expesereport') {

                    taxCodeByInvIdent = recordObj.getCurrentSublistValue({ sublistId: 'expense', fieldId: 'custcol_lmry_taxcode_by_inv_ident' });

                    if (taxCodeByInvIdent != null && taxCodeByInvIdent != '') {

                        var customSearch = search.lookupFields({
                            type: 'customrecord_lmry_ste_tc_by_inv_ident',
                            id: taxCodeByInvIdent,
                            columns: [
                                'custrecord_lmry_ste_invoicing_id',
                                'custrecord_lmry_ste_invoicing_id_code'
                            ]
                        });

                        recordObj.setCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: 'custcol_lmry_invoicing_id',
                            value: customSearch.custrecord_lmry_ste_invoicing_id[0].value,
                            ignoreFieldChange: true
                        });
                        recordObj.setCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: 'custcol_lmry_invoicing_id_code',
                            value: customSearch.custrecord_lmry_ste_invoicing_id_code,
                            ignoreFieldChange: true
                        });

                    }

                }

                return true;

            } catch (error) {
                Library_Mail.sendemail('[ validateField - setInvoicingIdentifier ]: ' + error, LMRY_SCRIPT);
                Library_Log.doLog({ title: '[ validateField - setInvoicingIdentifier ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
            }

        }

        return {
            setInvoicingIdentifier: setInvoicingIdentifier
        };

    });
