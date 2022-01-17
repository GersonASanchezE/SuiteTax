/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_LatamTax_Purchase_Pre_STLT_V2.0.js       ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Feb 05 2020  LatamReady    Bundle 37714             ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */

define(['N/runtime', 'N/ui/serverWidget', 'N/log', 'N/redirect', 'N/url', 'N/record',
    './Latam_Library/LMRY_BR_LatamTax_Purchase_LBRY_V2.0',
    './Latam_Library/LMRY_BR_ST_Purchase_Tax_Transaction_LBRY_V2.0',
    './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'
],
    function (runtime, serverWidget, log, redirect, url, record, libraryTaxPurchase, BR_TaxLibrary, libraryMail) {

        var LMRY_script = 'LatamReady - BR LatamTax Purchase Pre STLT';
        var ST_FEATURE = false;

        var lblform = '';
        var lblprimary = '';
        var lblinline = '';
        var lblResultados = '';
        var lblerror = '';
        var btnsave = '';
        var btnback = '';

        function onRequest(scriptContext) {
            try {

                var Language = runtime.getCurrentScript().getParameter({
                    name: 'LANGUAGE'
                });
                ST_FEATURE = runtime.isFeatureInEffect({
                    feature: 'tax_overhauling'
                });
                var featureSub = runtime.isFeatureInEffect({
                    feature: 'SUBSIDIARIES'
                });
                Language = Language.substring(0, 2);
                switch (Language) {
                    case 'es':
                        lblform = 'LatamTax Compras Prevista';
                        lblprimary = 'Informacion Primaria';
                        lblinline = 'Importante: Este proceso tardar&aacute; dependiendo de la cantidad de facturas a canjear';
                        lblResultados = 'Resultados';
                        lblerror = 'Importante: El acceso no esta permitido.';
                        btnsave = 'Guardar';
                        btnback = 'Regresar';
                        var SubItem = 'Artículo';
                        var SubPos = 'Posición';
                        var SubType = 'Tipo';
                        var SubBaseAmt = 'Monto base';
                        var SubTaxCal = 'Cálculo de impuesto';
                        var SubPer = 'Porcentaje';
                        var SubICMSOrig = 'Monto DIFAL';
                        var SubAlICMSOrig = 'Alicuota Origen ICMS';
                        var SubAlICMSDest = 'Alicuota Destino ICMS';
                        var LblText = 'Texto';
                        break;

                    case 'pt':
                        lblform = 'LatamTax Compras Visualização';
                        lblprimary = 'Informação Primária';
                        lblinline = 'Importante: Este processo demorará dependendo do número de notas a serem trocadas';
                        lblResultados = 'Resultados';
                        lblerror = 'Importante: o acesso não é permitido.';
                        btnsave = 'Salve';
                        btnback = 'Atrás';
                        var SubItem = 'Artigo';
                        var SubPos = 'Posição';
                        var SubType = 'O tipo';
                        var SubBaseAmt = 'Valor Base';
                        var SubTaxCal = 'Cálculo de Imposto';
                        var SubPer = 'Percentagem';
                        var SubICMSOrig = 'Monto DIFAL';
                        var SubAlICMSOrig = 'Alíquota de origem ICMS';
                        var SubAlICMSDest = 'Alíquota de Ddstino ICMS';
                        var LblText = 'Texto';
                        break;

                    default:
                        lblform = 'LatamTax Purchase Preview';
                        lblprimary = 'Primary Information';
                        lblinline = 'Important: This process will take depending on the number of bills to be exchanged';
                        lblResultados = 'Results';
                        lblerror = 'Important: Access is not allowed.';
                        btnsave = 'Save';
                        btnback = 'Back';
                        var SubItem = 'ITEM';
                        var SubPos = 'POSITION';
                        var SubType = 'TYPE';
                        var SubBaseAmt = 'BASE AMOUNT';
                        var SubTaxCal = 'TAX CALCULATION';
                        var SubPer = 'PERCENTAGE';
                        var SubICMSOrig = 'DIFAL Amount';
                        var SubAlICMSOrig = 'ALIQUOT ICMS ORIGIN';
                        var SubAlICMSDest = 'ALIQUOT ICMS DESTINATION';
                        var LblText = 'TEXT';

                }

                if (scriptContext.request.method == 'GET') {
                    var idTransaction = scriptContext.request.parameters.internalid;
                    var typeTransaction = scriptContext.request.parameters.typetran;
                    log.error('idTransaction', idTransaction);
                    log.error('typeTransaction', typeTransaction);

                    var recordTransaction = record.load({
                        type: typeTransaction,
                        id: idTransaction
                    });


                    var subsi = featureSub ? recordTransaction.getValue('subsidiary') : 1;

                    var licenses = libraryMail.getLicenses(subsi);

                    var featureDifalAuto = libraryMail.getAuthorization(648, licenses);

                    //Setup Tax Subsidiary
                    var setupTax = "";
                    if (ST_FEATURE == true || ST_FEATURE == "T") {
                        setupTax = BR_TaxLibrary.getSetupTaxSubsidiary(subsi);
                    } else {
                        setupTax = libraryTaxPurchase.getSetupTaxSubsidiary(subsi);
                    }

                    var JsonResult = {};
                    if (ST_FEATURE == true || ST_FEATURE == "T") {
                        JsonResult = BR_TaxLibrary.getTaxPurchase(recordTransaction, setupTax, featureDifalAuto, true);
                    } else {
                        JsonResult = libraryTaxPurchase.getTaxPurchase(recordTransaction, setupTax, featureDifalAuto, true);
                    }
                    log.error('JsonResult', JsonResult);
                    log.error('typeof JsonResult', typeof JsonResult);

                    var form = serverWidget.createForm({
                        title: lblform
                    });
                    form.addFieldGroup({
                        id: 'group_pi',
                        label: lblprimary
                    });
                    log.error('hito', 'hito1');
                    var p_texto = form.addField({
                        id: 'custpage_id_texto',
                        label: LblText,
                        type: serverWidget.FieldType.INLINEHTML,
                        container: 'group_pi'
                    });
                    var strhtml = "<html>";
                    strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>" +
                        "<tr>" +
                        "</tr>" +
                        "<tr>" +
                        "<td class='text'>" +
                        "<div style=\"color: gray; font-size: 8pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">" +
                        lblinline +
                        "</div>" +
                        "</td>" +
                        "</tr>" +
                        "</table>" +
                        "</html>";

                    p_texto.defaultValue = strhtml;

                    log.error('hito', 'hito2');
                    //Creación del Log
                    var SubTabla = form.addSublist({
                        id: 'custpage_id_sublista',
                        type: serverWidget.SublistType.LIST,
                        label: lblResultados
                    });

                    SubTabla.addField({
                        id: 'id_item',
                        label: SubItem,
                        type: serverWidget.FieldType.TEXT
                    });
                    SubTabla.addField({
                        id: 'id_pos',
                        label: SubPos,
                        type: serverWidget.FieldType.TEXT
                    });
                    SubTabla.addField({
                        id: 'id_type',
                        label: SubType,
                        type: serverWidget.FieldType.TEXT
                    });
                    SubTabla.addField({
                        id: 'id_bamount',
                        label: SubBaseAmt,
                        type: serverWidget.FieldType.TEXT
                    });
                    SubTabla.addField({
                        id: 'id_total',
                        label: SubTaxCal,
                        type: serverWidget.FieldType.TEXT
                    });
                    SubTabla.addField({
                        id: 'id_rate',
                        label: SubPer,
                        type: serverWidget.FieldType.TEXT
                    });
                    var difalAmtField = SubTabla.addField({
                        id: 'id_difalamt',
                        label: SubICMSOrig,
                        type: serverWidget.FieldType.TEXT
                    });
                    var difalRateField = SubTabla.addField({
                        id: 'id_difalrate',
                        label: SubAlICMSOrig,
                        type: serverWidget.FieldType.TEXT
                    });
                    var difalRateDestinationField = SubTabla.addField({
                        id: 'id_difalrate_des',
                        label: SubAlICMSDest,
                        type: serverWidget.FieldType.TEXT
                    });

                    var cont = 0,
                        contDifal = 0;
                    for (var key in JsonResult) {
                        for (var i = 0; i < JsonResult[key].length; i++) {

                            if (JsonResult[key][i].itemsName) {
                                SubTabla.setSublistValue({
                                    id: 'id_item',
                                    line: cont,
                                    value: JsonResult[key][i].itemsName
                                });
                            }
                            var position = Number(JsonResult[key][i].posicionItem) + 1;
                            if (position) {
                                SubTabla.setSublistValue({
                                    id: 'id_pos',
                                    line: cont,
                                    value: position.toFixed(0)
                                });
                            }
                            if (JsonResult[key][i].subType) {
                                SubTabla.setSublistValue({
                                    id: 'id_type',
                                    line: cont,
                                    value: JsonResult[key][i].subType
                                });
                            }
                            if (JsonResult[key][i].baseAmount) {
                                SubTabla.setSublistValue({
                                    id: 'id_bamount',
                                    line: cont,
                                    value: JsonResult[key][i].baseAmount.toFixed(2)
                                });
                            }
                            //if (JsonResult[key][i].retencion) {
                                SubTabla.setSublistValue({
                                    id: 'id_total',
                                    line: cont,
                                    value: JsonResult[key][i].retencion.toFixed(2)
                                });
                            //}
                            //if (JsonResult[key][i].taxRate) {
                                SubTabla.setSublistValue({
                                    id: 'id_rate',
                                    line: cont,
                                    value: JsonResult[key][i].taxRate
                                });
                            //}

                            if (featureDifalAuto) {
                                if (JsonResult[key][i]["difalAmountauto"]) {
                                    SubTabla.setSublistValue({
                                        id: "id_difalamt",
                                        line: cont,
                                        value: JsonResult[key][i]["difalAmountauto"]
                                    });
                                    contDifal++
                                }
                                if (JsonResult[key][i]["difalOrigen"]) {
                                    SubTabla.setSublistValue({
                                        id: "id_difalrate",
                                        line: cont,
                                        value: JsonResult[key][i]["difalOrigen"] + '%'
                                    });
                                }
                                if (JsonResult[key][i]["difalDestination"]) {
                                    SubTabla.setSublistValue({
                                        id: "id_difalrate_des",
                                        line: cont,
                                        value: JsonResult[key][i]["difalDestination"] + '%'
                                    });
                                }
                            } else {
                                if (JsonResult[key][i]["difalFxAmount"]) {
                                    SubTabla.setSublistValue({
                                        id: "id_difalamt",
                                        line: cont,
                                        value: JsonResult[key][i]["difalFxAmount"]
                                    });
                                    contDifal++
                                }

                                if (JsonResult[key][i]["difalTaxRate"]) {
                                    SubTabla.setSublistValue({
                                        id: "id_difalrate",
                                        line: cont,
                                        value: JsonResult[key][i]["difalTaxRate"]
                                    });
                                }
                            }


                            cont++;
                        }
                    }

                    log.error('cont', cont);

                    if (featureDifalAuto) {
                        if (!contDifal) {
                            difalAmtField.updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.HIDDEN
                            })
                            difalRateField.updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.HIDDEN
                            });
                            difalRateDestinationField.updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.HIDDEN
                            });
                        }
                    } else {
                        if (!contDifal) {
                            difalAmtField.updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.HIDDEN
                            })
                            difalRateField.updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.HIDDEN
                            });
                        }
                        difalRateDestinationField.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        });
                    }


                    /*form.addSubmitButton({
                        label: btnsave
                    });

                    form.addButton({
                        id: 'buttonid',
                        label: btnback,
                        functionName: 'redirectBack()'
                    });*/

                    // Script Cliente
                    //form.clientScriptModulePath = './LMRY_PE_LatamTax_CLNT_V2.0.js';

                    scriptContext.response.writePage(form);
                } else {
                    redirect.toSuitelet({
                        scriptId: runtime.getCurrentScript().id,
                        deploymentId: runtime.getCurrentScript().deploymentId
                    });
                }

            } catch (err) {
                log.error(LMRY_script + ' [onRequest]', err);
                var form = serverWidget.createForm({
                    title: lblform
                });
                var myInlineHtml = form.addField({
                    id: 'custpage_id_message',
                    label: 'MESSAGE',
                    type: serverWidget.FieldType.INLINEHTML
                });
                myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
                myInlineHtml.updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });

                var strhtml = "<html>";
                strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>" +
                    "<tr>" +
                    "</tr>" +
                    "<tr>" +
                    "<td class='text'>" +
                    "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">" + lblerror + "</div>" +
                    "</td>" +
                    "</tr>" +
                    "</table>" +
                    "</html>";

                myInlineHtml.defaultValue = strhtml;

                // Dibuja el Formulario
                scriptContext.response.writePage(form);

            }
            return true;
        }



        return {
            onRequest: onRequest
        };

    });
