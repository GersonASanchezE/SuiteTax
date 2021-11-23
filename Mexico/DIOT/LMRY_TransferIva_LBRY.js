/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_TransferIva_LBRY.js                         ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 19 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/search', 'N/log', 'N/record', 'N/runtime'],

    function (search, log, record, runtime) {

        /* ------------------------------------------------------------------------------------------------------
         * Funcion que crea o edita el registro LatamReady - MX Transaction Fields
         * --------------------------------------------------------------------------------------------------- */

        var ST_FEATURE = false;

        function generateMXTransField(context) {
            try {
                var transObj = context.newRecord;
                var transId = transObj.id;
                var typeTran = transObj.type;
                var check = context.check;
                var netamount = 0;
                var taxamount = 0;
                var grossamount = 0;
                var currency;
                var exchangerate;

                ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

                var entity = transObj.getValue('entity');

                switch (typeTran) {
                    case 'invoice':
                        netamount = transObj.getValue('subtotal');
                        taxamount = transObj.getValue('taxtotal');
                        grossamount = transObj.getValue('total');
                        currency = transObj.getValue('currency');
                        exchangerate = transObj.getValue('exchangerate');
                        break;
                    case 'vendorbill':
                        netamount = transObj.getValue('grosstotal');
                        taxamount = transObj.getValue('taxtotal');
                        grossamount = transObj.getValue('total');
                        currency = transObj.getValue('currency');
                        exchangerate = transObj.getValue('exchangerate');
                        break;
                    case 'expensereport':
                        netamount = transObj.getValue('expense_total');
                        if( ST_FEATURE == true || ST_FEATURE == "T" ) {
                          taxamount = transObj.getValue('taxtotal');
                        } else {
                          taxamount = transObj.getValue('tax1amt');
                        }
                        grossamount = transObj.getValue('total');
                        currency = transObj.getValue('expensereportcurrency');
                        exchangerate = transObj.getValue('expensereportexchangerate');
                        break;
                }

                /*if (taxamount == 0) {
                    return true;
                }*/

                var searchMxTransField = search.create({
                    type: 'customrecord_lmry_mx_transaction_fields',
                    filters: [
                        ['custrecord_lmry_mx_transaction_related', 'is', transId]
                    ],
                    columns: [
                        'internalid',
                        search.createColumn({
                            name: 'custrecord_lmry_mx_amount_save',
                            sort: search.Sort.DESC
                        })
                    ]
                });
                searchMxTransField = searchMxTransField.run().getRange(0, 1000);

                var mxTransFieldID = 0;
                if (searchMxTransField != null && searchMxTransField != '') {
                    for (var i = 0; i < searchMxTransField.length; i++) {
                        if (!check) {
                            var saveCheck = searchMxTransField[i].getValue('custrecord_lmry_mx_amount_save');
                            if (saveCheck == true || saveCheck == 'T') {
                                mxTransFieldID = searchMxTransField[i].getValue('internalid');
                                break;
                            }
                        } else {
                            mxTransFieldID = searchMxTransField[i].getValue('internalid');
                            break;
                        }

                    }
                }

                var fieldsMX = {
                    'custrecord_lmry_mx_currency': currency,
                    'custrecord_lmry_mx_exchange_rate': exchangerate,
                    'custrecord_lmry_mx_amount_net': netamount ? netamount : grossamount - taxamount,
                    'custrecord_lmry_mx_amount_tax': taxamount ? taxamount : 0,
                    'custrecord_lmry_mx_amount_total': grossamount,
                    'custrecord_lmry_mx_amount_save': true,
                    'custrecord_lmry_mx_diot_iva_smx': 0,
                    'custrecord_lmry_mx_diot_iva_dsmx': 0,
                    'custrecord_lmry_mx_diot_iva_ismx': 0,
                    'custrecord_lmry_mx_diot_iva_iemx': 0,
                    'custrecord_lmry_mx_diot_iva_zmx': 0,
                    'custrecord_lmry_mx_diot_iva_emx': 0,
                    'custrecord_lmry_mx_diot_iva_snocmx': 0,
                    'custrecord_lmry_mx_diot_iva_inocmx': 0,
                    'custrecord_lmry_mx_diot_iva_s8mx': 0,
                    'custrecord_lmry_mx_diot_iva_s4mx': 0,
                    'custrecord_lmry_mx_diot_iva_s8nocmx': 0,
                    'custrecord_lmry_mx_diot_total_smx': 0,
                    'custrecord_lmry_mx_diot_total_dsmx': 0,
                    'custrecord_lmry_mx_diot_total_ismx': 0,
                    'custrecord_lmry_mx_diot_total_iemx': 0,
                    'custrecord_lmry_mx_diot_total_zmx': 0,
                    'custrecord_lmry_mx_diot_total_emx': 0,
                    'custrecord_lmry_mx_diot_total_snocmx': 0,
                    'custrecord_lmry_mx_diot_total_inocmx': 0,
                    'custrecord_lmry_mx_diot_total_s8mx': 0,
                    'custrecord_lmry_mx_diot_total_s4mx': 0,
                    'custrecord_lmry_mx_diot_total_s8nocmx': 0,
                    'custrecord_lmry_mx_diot_ret_smx': 0,
                    'custrecord_lmry_mx_diot_ret_dsmx': 0,
                    'custrecord_lmry_mx_diot_ret_ismx': 0,
                    'custrecord_lmry_mx_diot_ret_iemx': 0,
                    'custrecord_lmry_mx_diot_ret_zmx': 0,
                    'custrecord_lmry_mx_diot_ret_emx': 0,
                    'custrecord_lmry_mx_diot_ret_snocmx': 0,
                    'custrecord_lmry_mx_diot_ret_inocmx': 0,
                    'custrecord_lmry_mx_diot_ret_s8mx': 0,
                    'custrecord_lmry_mx_diot_ret_s4mx': 0,
                    'custrecord_lmry_mx_diot_ret_s8nocmx': 0,
                    'custrecord_lmry_mx_diot_iva_devoluciones': 0,
                    'custrecord_lmry_mx_diot_ret_iva_total': 0
                }

                if (mxTransFieldID == 0) {
                    var recordObj = record.create({
                        type: 'customrecord_lmry_mx_transaction_fields'
                    });
                    recordObj.setValue('custrecord_lmry_mx_transaction_related', transId);
                    recordObj.setValue('custrecord_lmry_mx_entity_related', entity);
                    for (var key in fieldsMX) {
                        recordObj.setValue(key, fieldsMX[key]);
                    }
                    /*recordObj.setValue('custrecord_lmry_mx_currency', currency);
                    recordObj.setValue('custrecord_lmry_mx_exchange_rate', exchangerate);
                    recordObj.setValue('custrecord_lmry_mx_amount_net', netamount ? netamount : grossamount - taxamount);
                    recordObj.setValue('custrecord_lmry_mx_amount_tax', taxamount);
                    recordObj.setValue('custrecord_lmry_mx_amount_total', grossamount);
                    recordObj.setValue('custrecord_lmry_mx_amount_save', true);*/
                    recordObj.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    });
                } else {
                    record.submitFields({
                        type: 'customrecord_lmry_mx_transaction_fields',
                        id: mxTransFieldID,
                        values: fieldsMX,
                        /*values: {
                            custrecord_lmry_mx_currency: currency,
                            custrecord_lmry_mx_exchange_rate: exchangerate,
                            custrecord_lmry_mx_amount_net: netamount ? netamount : grossamount - taxamount,
                            custrecord_lmry_mx_amount_tax: taxamount,
                            custrecord_lmry_mx_amount_total: grossamount,
                            custrecord_lmry_mx_amount_save: true
                        },*/
                        options: {
                            enableSourcing: true,
                            ignoreMandatoryFields: true,
                            disableTriggers: true
                        }
                    });
                }

            } catch (error) {
                log.error('error', error);
            }
            return true;
        }


        return {
            generateMXTransField: generateMXTransField
        };

    });
