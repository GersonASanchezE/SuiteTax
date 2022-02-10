/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_WHT_MASSIVE_PAYMENTS_STLT.js  				      ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 18 2019  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/record', 'N/currency', 'N/log', 'N/xml', 'N/ui/serverWidget', 'N/search', 'N/runtime', 'N/redirect', 'N/email', 'N/format',
    './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './Latam_Library/LMRY_Log_LBRY_V2.0'
  ],

  function(record, currency, log, xml, serverWidget, search, runtime, redirect, email, format, library, lbryLog) {
    // Nombre del Script
    var LMRY_script = "LatamReady - WHT MASSIVE PAYMENTS STLT";
    var category = runtime.getCurrentScript().getParameter({
      name: 'custscript_lmry_category'
    });
    var bank_details = runtime.getCurrentScript().getParameter({
      name: 'custscript_lmry_bank_details'
    });

    var Language = runtime.getCurrentScript().getParameter({
      name: 'LANGUAGE'
    });
    Language = Language.substring(0, 2);

    switch (Language) {
      case 'es':
        var LblDueDateFrom = 'Fecha de Vencimiento Desde';
        var LblDueDateTo = 'Fecha de Vencimiento Hasta';
        var LblForm = 'LatamTAX - WHT Pagos Masivos';
        var LblMsg1 = 'AVISO: Actualmente la licencia para este módulo está vencida, por favor contacte al equipo comercial de LatamReady';
        var LblMsg2 = 'También puedes contactar con nosotros a través de';
        var LblMsg3 = 'Importante: El acceso no está permitido';
        var LblGroup1 = 'Información Primaria';
        var LblTittleMsg = 'Mensaje';
        var LblMulti = 'Multibooking';
        var LblName = 'Nombre';
        var LblBook = 'Libro';
        var LblSub = 'Subsidiaria';
        var LblBaseCur = 'Moneda Base';
        var LblCur = 'Moneda';
        var LblAPAccount = 'Cuenta A/P';
        var LblBnkAccount = 'Cuenta Bancaria';
        var LblActPrd = 'Periodo Contable';
        var LblGroup2 = 'Classificación';
        var LblDpt = 'Departmento';
        var LblPyMtd = 'LATAM - Método de Pago';
        var LblClass = 'Clase';
        var LblLct = 'Ubicación';
        var LblIDProcess = 'ID Proceso';
        var TabTrans = 'Transacciones';
        var LblTrans = 'Transacción';
        var LblApply = 'Aplciar';
        var LblInternalID = 'ID Interno';
        var LblSublist = 'Sublista'
        var LblTotalAm = 'Monto Total';
        var LblDueAm = 'Monto Adeudado';
        var LblPay = 'Pago';
        var LblFiscalDoc = 'Documento Fiscal';
        var LblElecPay = 'Pago electrónico EFT';
        var LblDate = 'Fecha';
        var BtnBack = 'Atrás';
        var BtnSave = 'Guardar';
        var BtnFiltrar = 'Filtrar';
        var BtnReset = 'Reiniciar';
        var LblExRate = 'Tipo de Cambio';
        var BtnMarkAll = 'Marcar Todo';
        var BtnDesmarkAll = 'Desmarcar Todo';
        var LblHelp = 'Ayuda Detalles bancarios';
        var LblPayDate = 'Fecha de pago';
        var LblCashFlow = 'Flujo de Caja';
        break;

      case 'pt':
        var LblDueDateFrom = 'Data de Vencimento De';
        var LblDueDateTo = 'Data de Vencimento Para';
        var LblForm = 'LatamTAX - WHT Pagamentos Massivos';
        var LblMsg1 = 'AVISO: Atualmente a licença para este módulo expirou, entre em contato com a equipe comercial da LatamReady';
        var LblMsg2 = 'Você também pode nos contatar através de';
        var LblMsg3 = 'Importante: o acesso não é permitido';
        var LblGroup1 = 'Informação Primária';
        var LblTittleMsg = 'Mensagem';
        var LblMulti = 'Multibooking';
        var LblName = 'Nome';
        var LblBook = 'Livro';
        var LblSub = 'Subsidiária';
        var LblBaseCur = 'Moeda Base';
        var LblCur = 'Moeda';
        var LblAPAccount = 'Conta A/P';
        var LblBnkAccount = 'Conta bancária';
        var LblActPrd = 'Período contábil';
        var LblGroup2 = 'Classificação';
        var LblDpt = 'Departmento';
        var LblPyMtd = 'LATAM - Forma de Pagamento';
        var LblClass = 'Classe';
        var LblLct = 'Localização';
        var LblIDProcess = 'ID do Proceso';
        var TabTrans = 'Transações';
        var LblTrans = 'Transação';
        var LblApply = 'Aplicar';
        var LblInternalID = 'ID Interno';
        var LblSublist = 'Sublista'
        var LblTotalAm = 'Montante total';
        var LblDueAm = 'Quantia Devida';
        var LblPay = 'Pagamento';
        var LblFiscalDoc = 'Documento Fiscal';
        var LblElecPay = 'Pagamento Eletrônico EFT';
        var LblDate = 'Data';
        var BtnBack = 'Voltar';
        var BtnSave = 'Salve';
        var BtnFiltrar = 'Filtro';
        var BtnReset = 'Redefinir';
        var LblExRate = 'Taxa de câmbio';
        var BtnMarkAll = 'Marcar Tudo';
        var BtnDesmarkAll = 'Desmarcar Tudo';
        var LblHelp = 'Dados do Banco de Ajuda';
        var LblPayDate = 'Data de Pagamento';
        var LblCashFlow = 'Fluxo de caixa';
        break;

      default:
        var LblDueDateFrom = 'Due Date From';
        var LblDueDateTo = 'Due Date To';
        var LblForm = 'LatamTAX - WHT Massive Payments';
        var LblMsg1 = 'NOTICE: Currently the license for this module is expired, please contact the commercial team of LatamReady';
        var LblMsg2 = 'You can also contact us through';
        var LblMsg3 = 'Important: Access is not allowed';
        var LblGroup1 = 'Primary Information';
        var LblTittleMsg = 'Message';
        var LblMulti = 'Multibooking';
        var LblName = 'Name';
        var LblBook = 'Book';
        var LblSub = 'Subsidiary';
        var LblBaseCur = 'Base currency';
        var LblCur = 'Currency';
        var LblAPAccount = 'A/P Account';
        var LblBnkAccount = 'Bank Account';
        var LblActPrd = 'Accounting Period';
        var LblGroup2 = 'Classification';
        var LblDpt = 'Department';
        var LblPyMtd = 'LATAM - Payment Method';
        var LblClass = 'Class';
        var LblLct = 'Location';
        var LblIDProcess = 'Process ID';
        var TabTrans = 'Transactions';
        var LblTrans = 'Transaction';
        var LblApply = 'Apply';
        var LblInternalID = 'Internal ID';
        var LblSublist = 'Sublist'
        var LblTotalAm = 'Total amount';
        var LblDueAm = 'Amount due';
        var LblPay = 'Payment';
        var LblFiscalDoc = 'Fiscal Document';
        var LblElecPay = 'Electronic Payment EFT';
        var LblDate = 'Date';
        var BtnBack = 'Back';
        var BtnSave = 'Save';
        var BtnFiltrar = 'Filtrar';
        var BtnReset = 'Reset';
        var LblExRate = 'Exchange Rate';
        var BtnMarkAll = 'Mark all';
        var BtnDesmarkAll = 'Desmark all';
        var LblHelp = 'Help Bank Details';
        var LblPayDate = 'Payment Date';
        var LblCashFlow = 'Cash Flow';
    }

    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
      try {
        if (context.request.method == 'GET') {

          // 138 Argentina , 139 = Paraguay y 141 = Brasil

          var allLicenses = library.getAllLicenses();

          var subsi_OW = runtime.isFeatureInEffect({
            feature: "SUBSIDIARIES"
          });

          var Rd_SubId = context.request.parameters.custparam_subsi;
          var Rd_CurId = context.request.parameters.custparam_curre;
          var Rd_AccId = context.request.parameters.custparam_accon;
          var Rd_DateId = context.request.parameters.custparam_date;
          var Rd_BacId = context.request.parameters.custparam_bacco;
          var Rd_PerId = context.request.parameters.custparam_acper;
          var Rd_RatId = context.request.parameters.custparam_exrat;
          var Rd_DepId = context.request.parameters.custparam_depar;
          var Rd_ClaId = context.request.parameters.custparam_class;
          var Rd_LocId = context.request.parameters.custparam_locat;
          var Rd_MetId = context.request.parameters.custparam_metho;
          var Rd_CatId = context.request.parameters.custparam_categ;
          var Rd_FroId = context.request.parameters.custparam_datef;
          var Rd_TooId = context.request.parameters.custparam_datet;

          var form = serverWidget.createForm({
            title: LblForm
          });
          form.addFieldGroup({
            id: 'group_pi',
            label: LblGroup1
          });

          //Subsidiary --one world
          if (subsi_OW == true) {

            var p_subsi = form.addField({
              id: 'custpage_id_subsi',
              label: LblSub,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });

            var Filter_Custo = new Array();
            Filter_Custo[0] = search.createFilter({
              name: 'isinactive',
              operator: search.Operator.IS,
              values: 'F'
            });
            Filter_Custo[1] = search.createFilter({
              name: 'country',
              operator: search.Operator.ANYOF,
              values: 'AR'
            });

            var search_Subs = search.create({
              type: search.Type.SUBSIDIARY,
              filters: Filter_Custo,
              columns: ['internalid', 'name']
            });
            var resul_sub = search_Subs.run().getRange({
              start: 0,
              end: 1000
            });

            var contador = 0;

            if (resul_sub != null && resul_sub.length > 0) {
              // Llena una linea vacia
              p_subsi.addSelectOption({
                value: 0,
                text: ' '
              });
              // Llenado de listbox
              for (var i = 0; i < resul_sub.length; i++) {
                var subID = resul_sub[i].getValue('internalid');
                var subNM = resul_sub[i].getValue('name');

                if (allLicenses[subID] != null && allLicenses[subID] != undefined) {
                  for (var j = 0; j < allLicenses[subID].length; j++) {
                    if (allLicenses[subID][j] == 138) {
                      p_subsi.addSelectOption({
                        value: subID,
                        text: subNM
                      });
                      contador++;
                    }
                  }
                }

              }
            }

            if (contador == 0) {
              var form = serverWidget.createForm({
                title: LblForm
              });

              // Mensaje para el cliente
              var myInlineHtml = form.addField({
                id: 'custpage_lmry_v_message',
                label: LblTittleMsg,
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
                "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">" +
                LblMsg1 + ".</br>" + LblMsg2 + " www.Latamready.com" +
                "</div>" +
                "</td>" +
                "</tr>" +
                "</table>" +
                "</html>";
              myInlineHtml.defaultValue = strhtml;

              // Dibuja el formularios
              context.response.writePage(form);

              // Termina el SuiteLet
              return true;
            }

            p_subsi.isMandatory = true;

            var p_accountpay = form.addField({
              id: 'custpage_id_account_pay',
              label: LblAPAccount,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            var licenses = allLicenses[Rd_SubId] || [];
            if (!library.getAuthorization(675, licenses) || (Rd_AccId != null && Rd_AccId != "")) {
              p_accountpay.isMandatory = true;
            } else {
              p_accountpay.isMandatory = false;
            }


          } else {
            var p_accountpay = form.addField({
              id: 'custpage_id_account_pay',
              label: LblAPAccount,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            if (!library.getAuthorization(675, licenses) || (Rd_AccId != null && Rd_AccId != "")) {
              p_accountpay.isMandatory = true;
            } else {
              p_accountpay.isMandatory = false;
            }

            var search_pay = search.load({
              id: 'customsearch_lmry_wht_account_payable'
            });
            search_pay.filters.push(search.createFilter({
              name: 'isinactive',
              operator: 'is',
              values: 'F'
            }));

            var lengt_pay = search_pay.run().getRange({
              start: 0,
              end: 1000
            });

            if (lengt_pay != null && lengt_pay.length > 0) {
              var columns_app = lengt_pay[0].columns;
              p_accountpay.addSelectOption({
                value: 0,
                text: ' '
              });
              for (var i = 0; i < lengt_pay.length; i++) {
                var payID = lengt_pay[i].getValue(columns_app[0]);
                var payNM = lengt_pay[i].getValue(columns_app[1]);

                if (payNM != null && payNM != '') {
                  p_accountpay.addSelectOption({
                    value: payID,
                    text: payNM
                  });
                }
              }
            }

          }

          if (subsi_OW == true) {
            var p_bank = form.addField({
              id: 'custpage_id_bank',
              label: LblBnkAccount,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            p_bank.isMandatory = true;

          } else {
            var p_bank = form.addField({
              id: 'custpage_id_bank',
              label: LblBnkAccount,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi'
            });
            p_bank.isMandatory = true;

            var search_bank = search.load({
              id: 'customsearch_lmry_wht_bank_account'
            });
            search_bank.filters.push(search.createFilter({
              name: 'isinactive',
              operator: 'is',
              values: 'F'
            }));

            var lengt_bank = search_bank.run().getRange({
              start: 0,
              end: 1000
            });

            if (lengt_bank != null && lengt_bank.length > 0) {
              var columns_bank = lengt_bank[0].columns;
              p_bank.addSelectOption({
                value: 0,
                text: ' '
              });
              for (var i = 0; i < lengt_bank.length; i++) {
                var bankID = lengt_bank[i].getValue(columns_bank[0]);
                var bankNM = lengt_bank[i].getValue(columns_bank[1]);
                if (bankNM != null && bankNM != '') {
                  p_bank.addSelectOption({
                    value: bankID,
                    text: bankNM
                  });
                }
              }
            }
          }

          var p_curren = form.addField({
            id: 'custpage_id_curren',
            label: LblCur,
            type: serverWidget.FieldType.SELECT,
            container: 'group_pi'
          });
          p_curren.isMandatory = true;

          var p_datefrom = form.addField({
            id: 'custpage_id_datefrom',
            label: LblDueDateFrom,
            type: serverWidget.FieldType.DATE,
            source: 'date',
            container: 'group_pi'
          });
          p_datefrom.isMandatory = true;

          var p_dateto = form.addField({
            id: 'custpage_id_dateto',
            label: LblDueDateTo,
            type: serverWidget.FieldType.DATE,
            source: 'date',
            container: 'group_pi'
          });
          p_dateto.isMandatory = true;

          //FEATURE 465: AR - WHT CHANGE PAYMENT DATE
          var p_date = form.addField({
            id: 'custpage_id_date',
            label: LblPayDate,
            type: serverWidget.FieldType.DATE,
            source: 'date',
            container: 'group_pi'
          });
          p_date.isMandatory = true;

          var p_period = form.addField({
            id: 'custpage_id_period',
            label: LblActPrd,
            type: serverWidget.FieldType.SELECT,
            container: 'group_pi'
          });
          p_period.isMandatory = true;

          p_date.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.DISABLED
          });
          p_period.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.DISABLED
          });

          var p_exrate = form.addField({
            id: 'custpage_id_rate',
            label: LblExRate,
            type: serverWidget.FieldType.FLOAT,
            source: 'exchangerate',
            container: 'group_pi'
          });
          p_exrate.isMandatory = true;

          var p_memo = form.addField({
            id: 'custpage_id_memo',
            label: 'MEMO',
            type: serverWidget.FieldType.TEXT,
            container: 'group_pi'
          });

          if (category == true) {
            var p_category = form.addField({
              id: 'custpage_id_category',
              label: LblCashFlow,
              type: serverWidget.FieldType.SELECT,
              container: 'group_pi',
              source: 'vendorcategory'
            });
            p_category.isMandatory = true;

          }

          form.addField({
            id: 'custpage_data_log',
            label: 'Data Log',
            type: serverWidget.FieldType.LONGTEXT
          }).updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN
          });

          if (Rd_CurId != '' && Rd_CurId != null) {
            var p_stado = form.addField({
              id: 'id_state',
              label: LblIDProcess,
              type: serverWidget.FieldType.TEXT,
              container: 'group_pi'
            });
            p_stado.defaultValue = 'PENDIENTE';
            p_stado.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            /***************************************
             * Valida si esta instalado el bundle
             * 244403	Electronic Bank Payments
             ***************************************/
            var search_bundle = search.create({
              type: search.Type.SAVED_SEARCH,
              filters: [{
                name: "formulatext",
                formula: "{bundle.name}",
                operator: search.Operator.CONTAINS,
                values: ["Electronic Bank Payments"]
              }],
              columns: ["internalid"]
            });
            var result_bundle = search_bundle.run().getRange({
              start: 0,
              end: 1000
            });

            var filtros = new Array();
            filtros[0] = search.createFilter({
              name: 'isinactive',
              operator: 'is',
              values: ['F']
            });
            if (subsi_OW) {
              filtros[1] = search.createFilter({
                name: 'custrecord_lmry_setuptax_subsidiary',
                operator: 'is',
                values: Rd_SubId
              });
            }

            var search_setup = search.create({
              type: 'customrecord_lmry_setup_tax_subsidiary',
              filters: filtros,
              columns: ['custrecord_lmry_setuptax_elec_payment']
            });
            var result_search_setup = search_setup.run().getRange({
              start: 0,
              end: 10
            });
            if (result_search_setup != null && result_search_setup.length > 0) {
              var campo_eft = result_search_setup[0].getValue({
                name: 'custrecord_lmry_setuptax_elec_payment'
              });
              if (campo_eft && result_bundle.length > 0) {
                var p_eft = form.addField({
                  id: 'custpage_id_eft',
                  label: LblElecPay,
                  type: serverWidget.FieldType.CHECKBOX,
                  container: 'group_pi'
                });
              }
            }

          } else {
            p_memo.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });
          }

          form.addFieldGroup({
            id: 'group_cla',
            label: LblGroup2
          });

          //Activacion de enable features
          var enab_dep = runtime.isFeatureInEffect({
            feature: "DEPARTMENTS"
          });
          var enab_loc = runtime.isFeatureInEffect({
            feature: "LOCATIONS"
          });
          var enab_clas = runtime.isFeatureInEffect({
            feature: "CLASSES"
          });

          //activacion de Accounting Preferences
          var userObj = runtime.getCurrentUser();
          var pref_dep = userObj.getPreference({
            name: "DEPTMANDATORY"
          });
          var pref_loc = userObj.getPreference({
            name: "LOCMANDATORY"
          });
          var pref_clas = userObj.getPreference({
            name: "CLASSMANDATORY"
          });

          // Solo para One World
          if (subsi_OW == true) {
            if (enab_dep == true) {
              var c_depart = form.addField({
                id: 'custpage_id_depart',
                label: LblDpt,
                type: serverWidget.FieldType.SELECT,
                container: 'group_cla'
              });
              if (pref_dep == true) {
                c_depart.isMandatory = true;
              }
            }

            var c_payMeth = form.addField({
              id: 'custpage_id_method',
              label: LblPyMtd,
              type: serverWidget.FieldType.SELECT,
              container: 'group_cla'
            });
            c_payMeth.isMandatory = true;

            if (enab_loc == true) {
              var c_location = form.addField({
                id: 'custpage_id_location',
                label: LblLct,
                type: serverWidget.FieldType.SELECT,
                container: 'group_cla'
              });
              if (pref_loc == true) {
                c_location.isMandatory = true;
              }
            }

            if (enab_clas == true) {
              var c_class = form.addField({
                id: 'custpage_id_class',
                label: LblClass,
                type: serverWidget.FieldType.SELECT,
                container: 'group_cla'
              });
              if (pref_clas == true) {
                c_class.isMandatory = true;
              }
            }

            //  Cargas la ubicacion
            if (Rd_SubId != '' && Rd_SubId != null) {
              p_subsi.defaultValue = Rd_SubId;
              p_subsi.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
              });

              var subs = Rd_SubId;

              //Recargado de campo A/P Account
              p_accountpay.addSelectOption({
                value: 0,
                text: ' '
              });

              var search_acc_payable = search.load({
                id: 'customsearch_lmry_wht_account_payable'
              });
              search_acc_payable.filters.push(search.createFilter({
                name: 'subsidiary',
                operator: 'anyof',
                values: subs
              }));

              var result_acc_payable = search_acc_payable.run().getRange({
                start: 0,
                end: 1000
              });

              if (result_acc_payable != null && result_acc_payable.length > 0) {
                var columns_pay = result_acc_payable[0].columns;
                for (var i = 0; i < result_acc_payable.length; i++) {
                  var valores = result_acc_payable[i].getValue(columns_pay[0]);
                  var textos = result_acc_payable[i].getValue(columns_pay[1]);
                  if (textos != null && textos != '') {
                    p_accountpay.addSelectOption({
                      value: valores,
                      text: textos
                    });
                  }
                }
              }

              //Recargado de campo Bank ACCOUNT
              var field_bank = p_bank;
              p_bank.addSelectOption({
                value: 0,
                text: ' '
              });

              var search_bank = search.load({
                id: 'customsearch_lmry_wht_bank_account'
              });
              search_bank.filters.push(search.createFilter({
                name: 'subsidiary',
                operator: 'anyof',
                values: subs
              }));

              var result_bank = search_bank.run().getRange({
                start: 0,
                end: 1000
              });

              if (result_bank != null && result_bank.length > 0) {
                var columns_bank = result_bank[0].columns;
                for (var i = 0; i < result_bank.length; i++) {
                  var valores = result_bank[i].getValue(columns_bank[0]);
                  var textos = result_bank[i].getValue(columns_bank[1]);
                  if (textos != null && textos != '') {
                    p_bank.addSelectOption({
                      value: valores,
                      text: textos
                    });
                  }

                }
              }

              //Reseteo campo accounting period
              p_period.addSelectOption({
                value: 0,
                text: ' '
              });

              var search_period = search.load({
                id: 'customsearch_lmry_open_accounting_period'
              });
              var lengt_period = search_period.run().getRange({
                start: 0,
                end: 1000
              });;

              if (lengt_period != null && lengt_period.length > 0) {
                for (var i = 0; i < lengt_period.length; i++) {
                  var valores = lengt_period[i].getValue('internalid');
                  var textos = lengt_period[i].getValue('periodname');
                  p_period.addSelectOption({
                    value: valores,
                    text: textos
                  });
                }
              }

              //Reseteo campo currency
              p_curren.addSelectOption({
                value: 0,
                text: ' '
              });
              var search_setuptax = search.create({
                type: 'customrecord_lmry_setup_tax_subsidiary',
                filters: [{
                    name: 'custrecord_lmry_setuptax_subsidiary',
                    operator: 'is',
                    values: Rd_SubId
                  },
                  {
                    name: 'isinactive',
                    operator: 'is',
                    values: 'F'
                  }
                ],
                columns: ['custrecord_lmry_setuptax_multicurrency']
              });

              var result_setuptax = search_setuptax.run().getRange({
                start: 0,
                end: 1
              });

              if (result_setuptax != null && result_setuptax.length > 0) {

                if (result_setuptax[0].getValue('custrecord_lmry_setuptax_multicurrency') != null && result_setuptax[0].getValue('custrecord_lmry_setuptax_multicurrency') != '') {
                  var currency_value = result_setuptax[0].getValue('custrecord_lmry_setuptax_multicurrency').split(',');

                  /*for(var i=0;i<currency_value.length;i++){
                  	p_curren.addSelectOption({value: currency_value[i],text: currency_text[i]});
                  }*/

                  for (var i = 0; i < currency_value.length; i++) {
                    var c_text = search.lookupFields({
                      type: search.Type.CURRENCY,
                      id: currency_value[i],
                      columns: ['name']
                    });
                    c_text = c_text.name;
                    p_curren.addSelectOption({
                      value: currency_value[i],
                      text: c_text
                    });
                  }
                }

              }

              // Carga el departamento filtrado por subsidiaria
              if (enab_dep == true) {
                c_depart.addSelectOption({
                  value: 0,
                  text: ' '
                });

                var Search_depart = search.create({
                  type: search.Type.DEPARTMENT,
                  columns: ['internalid', 'name'],
                  filters: [{
                    name: 'subsidiary',
                    operator: 'anyof',
                    values: [subs]
                  }]
                });
                var Result_dept = Search_depart.run().getRange({
                  start: 0,
                  end: 100
                });

                if (Result_dept != null && Result_dept.length > 0) {
                  for (var i = 0; i < Result_dept.length; i++) {
                    c_depart.addSelectOption({
                      value: Result_dept[i].getValue({
                        name: 'internalid'
                      }),
                      text: Result_dept[i].getValue({
                        name: 'name'
                      })
                    });
                  }
                }
              }

              // Carga el Class filtrado por subsidiaria
              if (enab_clas == true) {
                c_class.addSelectOption({
                  value: 0,
                  text: ' '
                });

                var Search_clas = search.create({
                  type: search.Type.CLASSIFICATION,
                  columns: ['internalid', 'name'],
                  filters: [{
                    name: 'subsidiary',
                    operator: 'anyof',
                    values: [subs]
                  }]
                });
                var Result_class = Search_clas.run().getRange({
                  start: 0,
                  end: 100
                });

                if (Result_class != null) {
                  for (var i = 0; i < Result_class.length; i++) {
                    c_class.addSelectOption({
                      value: Result_class[i].getValue({
                        name: 'internalid'
                      }),
                      text: Result_class[i].getValue({
                        name: 'name'
                      })
                    });
                  }
                }
              }

              if (enab_loc == true) {
                // Carga el location filtrado por subsidiaria
                c_location.addSelectOption({
                  value: 0,
                  text: ' '
                });

                var Search_loc = search.create({
                  type: search.Type.LOCATION,
                  columns: ['internalid', 'name'],
                  filters: [{
                    name: 'subsidiary',
                    operator: 'anyof',
                    values: subs
                  }]
                });
                var Result_loc = Search_loc.run().getRange({
                  start: 0,
                  end: 100
                });

                if (Result_loc != null) {
                  for (var i = 0; i < Result_loc.length; i++) {
                    c_location.addSelectOption({
                      value: Result_loc[i].getValue({
                        name: 'internalid'
                      }),
                      text: Result_loc[i].getValue({
                        name: 'name'
                      })
                    });
                  }
                }
              }

              // Carga el LATAM - PAYMENT METHOD filtrado por subsidiaria
              var field_met = c_payMeth;
              c_payMeth.addSelectOption({
                value: 0,
                text: ' '
              });

              if (subs != '' && subs != null) {
                // Pais de la subsidiaria
                var rcd_country = search.lookupFields({
                  type: search.Type.SUBSIDIARY,
                  id: subs,
                  columns: ['country']
                });
                var country = rcd_country.country[0].text;
                var Search_met = search.create({
                  type: 'customrecord_lmry_paymentmethod',
                  columns: ['internalid', 'name', 'custrecord_lmry_country_pm'],
                  filters: [{
                    name: 'isinactive',
                    operator: 'is',
                    values: 'F'
                  }]
                });

                var Result_met = Search_met.run().getRange({
                  start: 0,
                  end: 100
                });

                if (Result_met != null) {
                  for (var i = 0; i < Result_met.length; i++) {
                    var res_cont = Result_met[i].getText({
                      name: 'custrecord_lmry_country_pm'
                    });
                    if (country == res_cont) {
                      c_payMeth.addSelectOption({
                        value: Result_met[i].getValue({
                          name: 'internalid'
                        }),
                        text: Result_met[i].getValue({
                          name: 'name'
                        })
                      });
                    }
                  }

                  // Seteo en el rellamado
                  if (Rd_MetId != '' && Rd_MetId != null) {
                    c_payMeth.defaultValue = Rd_MetId;
                    c_payMeth.updateDisplayType({
                      displayType: serverWidget.FieldDisplayType.DISABLED
                    });
                  }
                }
              }
            } // Fin if Rd_Sub, y el de abajo si es One_World
          } else {
            //Mismarket Edition
            if (enab_dep == true) {
              var c_depart = form.addField({
                id: 'custpage_id_depart',
                label: LblDpt,
                type: serverWidget.FieldType.SELECT,
                source: 'department',
                container: 'group_cla'
              });
              c_depart.isMandatory = true;
            }

            var c_payMeth = form.addField({
              id: 'custpage_id_method',
              label: LblPyMtd,
              type: serverWidget.FieldType.SELECT,
              source: 'custbody_lmry_paymentmethod',
              container: 'group_cla'
            });
            c_payMeth.isMandatory = true;

            if (enab_loc == true) {
              var c_location = form.addField({
                id: 'custpage_id_location',
                label: LblLct,
                type: serverWidget.FieldType.SELECT,
                source: 'location',
                container: 'group_cla'
              });
              c_location.isMandatory = true;
            }

            if (enab_clas == true) {
              var c_class = form.addField({
                id: 'custpage_id_class',
                label: LblClass,
                type: serverWidget.FieldType.SELECT,
                source: 'class',
                container: 'group_cla'
              });
              c_class.isMandatory = true;
            }
          }

          //SETEOS RELLAMADO
          if (Rd_CurId != null && Rd_CurId != '') {
            p_curren.defaultValue = Rd_CurId;
            p_date.defaultValue = Rd_DateId;
            p_bank.defaultValue = Rd_BacId;
            p_accountpay.defaultValue = Rd_AccId;
            p_exrate.defaultValue = Rd_RatId;
            c_payMeth.defaultValue = Rd_MetId;
            p_period.defaultValue = Rd_PerId;

            p_datefrom.defaultValue = Rd_FroId;
            p_dateto.defaultValue = Rd_TooId;

            p_datefrom.updateDisplayType({
              displayType: 'disabled'
            });
            p_dateto.updateDisplayType({
              displayType: 'disabled'
            });
            p_date.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });
            p_period.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });

            p_curren.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });

            p_bank.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });
            p_accountpay.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });
            p_exrate.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });
            c_payMeth.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });


            if (enab_dep == true) {
              c_depart.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
              });
            }
            if (enab_loc == true) {
              c_location.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
              });
            }
            if (enab_clas == true) {
              c_class.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
              });
            }

            if (category == true) {
              p_category.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
              });
            }

          }

          if (Rd_ClaId != '' && Rd_ClaId != null) {
            c_class.defaultValue = Rd_ClaId;
          }
          // Seteo en el rellamado
          if (Rd_LocId != '' && Rd_LocId != null) {
            c_location.defaultValue = Rd_LocId;
          }

          if (Rd_DepId != '' && Rd_DepId != null) {
            c_depart.defaultValue = Rd_DepId;
          }

          if (Rd_CatId != '' && Rd_CatId != null && category == true) {
            p_category.defaultValue = Rd_CatId;
          }

          var tab_a = form.addTab({
            id: 'custpage_tab1',
            label: TabTrans
          });

          var featureMB = runtime.isFeatureInEffect({
            feature: "MULTIBOOK"
          });
          log.error("multibook", featureMB);

          if (Rd_CurId != '' && Rd_CurId != null && subsi_OW == true && featureMB == true) {
            var filtros = new Array();
            filtros[0] = search.createFilter({
              name: 'isinactive',
              operator: 'is',
              values: ['F']
            });
            if (subsi_OW) {
              filtros[1] = search.createFilter({
                name: 'custrecord_lmry_setuptax_subsidiary',
                operator: 'is',
                values: Rd_SubId
              });
            }

            var search_multibooking = search.create({
              type: 'customrecord_lmry_setup_tax_subsidiary',
              columns: ['custrecord_lmry_setuptax_currency'],
              filters: filtros
            });
            var result_multibooking = search_multibooking.run().getRange({
              start: 0,
              end: 1
            });

            var currency_setup = result_multibooking[0].getValue({
              name: 'custrecord_lmry_setuptax_currency'
            });
            var currency_sub = search.lookupFields({
              type: search.Type.SUBSIDIARY,
              id: Rd_SubId,
              columns: ['currency']
            });
            currency_sub = currency_sub.currency[0].value;

            var multibooking_flag = false;
            if (currency_setup != currency_sub && currency_setup != Rd_CurId) {
              multibooking_flag = true;
            }

            if (multibooking_flag) {
              var tab_a = form.addTab({
                id: 'custpage_tab2',
                label: LblMulti
              });

              var SubTabla_Book = form.addSublist({
                id: 'custpage_id_sublista_book',
                type: serverWidget.SublistType.LIST,
                label: LblSublist,
                tab: 'custpage_tab2'
              });

              SubTabla_Book.addField({
                id: 'custpage_id_book',
                label: LblBook,
                type: serverWidget.FieldType.TEXT
              });
              SubTabla_Book.addField({
                id: 'custpage_id_currency',
                label: LblBaseCur,
                type: serverWidget.FieldType.TEXT
              });
              var ex_book = SubTabla_Book.addField({
                id: 'custpage_id_rate_book',
                label: LblExRate,
                type: serverWidget.FieldType.FLOAT
              }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.ENTRY
              });

              if (Rd_CurId != '' && Rd_CurId != null) {
                ex_book.isMandatory = true;

                var search_isocode = search.lookupFields({
                  type: search.Type.CURRENCY,
                  id: currency_sub,
                  columns: ['symbol']
                });
                search_isocode = search_isocode.symbol;

                log.error('isocode', search_isocode);

                var search_book = record.load({
                  type: search.Type.SUBSIDIARY,
                  id: Rd_SubId
                });

                var c_lineas = search_book.getLineCount({
                  sublistId: 'accountingbookdetail'
                });
                if (c_lineas > 0) {
                  for (var i = 0; i < c_lineas; i++) {
                    var name_book = search_book.getSublistText({
                      sublistId: 'accountingbookdetail',
                      fieldId: 'accountingbook',
                      line: i
                    });
                    var currency_book = search_book.getSublistText({
                      sublistId: 'accountingbookdetail',
                      fieldId: 'currency',
                      line: i
                    });
                    var status_book = search_book.getSublistText({
                      sublistId: 'accountingbookdetail',
                      fieldId: 'bookstatus',
                      line: i
                    });
                    status_book = status_book.substring(0, 3);
                    status_book = status_book.toUpperCase();

                    if (status_book != 'ACT') {
                      continue;
                    }

                    var search_isocode_book = search.lookupFields({
                      type: search.Type.CURRENCY,
                      id: search_book.getSublistValue({
                        sublistId: 'accountingbookdetail',
                        fieldId: 'currency',
                        line: i
                      }),
                      columns: ['symbol']
                    });
                    search_isocode_book = search_isocode_book.symbol;

                    var rate = currency.exchangeRate({
                      source: search_isocode,
                      target: search_isocode_book,
                      date: new Date()
                    });

                    SubTabla_Book.setSublistValue({
                      id: 'custpage_id_book',
                      line: i,
                      value: name_book
                    });
                    SubTabla_Book.setSublistValue({
                      id: 'custpage_id_currency',
                      line: i,
                      value: currency_book
                    });
                    SubTabla_Book.setSublistValue({
                      id: 'custpage_id_rate_book',
                      line: i,
                      value: rate
                    });

                  }
                }

              }
            }
          }

          var SubTabla = form.addSublist({
            id: 'custpage_id_sublista',
            type: serverWidget.SublistType.LIST,
            label: LblSublist,
            tab: 'custpage_tab1'
          });

          SubTabla.addField({
            id: 'id_appl',
            label: LblApply,
            type: serverWidget.FieldType.CHECKBOX
          });
          SubTabla.addField({
            id: 'id_int',
            label: LblInternalID,
            type: serverWidget.FieldType.TEXT
          });
          SubTabla.addField({
            id: 'id_tran',
            label: LblTrans,
            type: serverWidget.FieldType.TEXT
          });
          SubTabla.addField({
            id: 'id_date',
            label: LblDate,
            type: serverWidget.FieldType.DATE
          });
          SubTabla.addField({
            id: 'id_vend',
            label: LblName,
            type: serverWidget.FieldType.SELECT,
            source: 'vendor'
          }).updateDisplayType({
            displayType: serverWidget.FieldDisplayType.DISABLED
          });
          //campo cuenta modificacion para argentina
          var licenses = allLicenses[Rd_SubId] || [];
          if ((Rd_AccId == null || Rd_AccId == "") && library.getAuthorization(675, licenses)) {
            SubTabla.addField({
              id: 'id_account',
              label: "account",
              type: serverWidget.FieldType.SELECT,
              source: 'account'
            }).updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });
          }
          var document = SubTabla.addField({
            id: 'id_doc',
            label: LblFiscalDoc,
            type: serverWidget.FieldType.SELECT,
            source: 'customrecord_lmry_tipo_doc'
          });
          document.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.DISABLED
          });
          SubTabla.addField({
            id: 'id_exch',
            label: LblExRate,
            type: serverWidget.FieldType.FLOAT
          });

          SubTabla.addField({
            id: 'id_cred',
            label: 'Bill Credit',
            type: serverWidget.FieldType.FLOAT
          });
          SubTabla.addField({
            id: 'id_json',
            label: 'JSON CREDIT',
            type: serverWidget.FieldType.TEXTAREA
          }).updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN
          });;

          SubTabla.addField({
            id: 'id_tota',
            label: LblTotalAm,
            type: serverWidget.FieldType.FLOAT
          });
          var desab = SubTabla.addField({
            id: 'id_amou',
            label: LblDueAm,
            type: serverWidget.FieldType.CURRENCY
          }).updateDisplayType({
            displayType: serverWidget.FieldDisplayType.ENTRY
          });

          desab.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.DISABLED
          });

          SubTabla.addField({
            id: 'id_pay',
            label: LblPay,
            type: serverWidget.FieldType.CURRENCY
          }).updateDisplayType({
            displayType: serverWidget.FieldDisplayType.ENTRY
          });

          //modificacion argentina
          //  if ((Rd_SubId != null && Rd_SubId != '') && (Rd_CurId != null && Rd_CurId != '') && (Rd_AccId != null && Rd_AccId != '')) {
          if ((Rd_SubId != null && Rd_SubId != '') && (Rd_CurId != null && Rd_CurId != '')) {

            SubTabla.addButton({
              id: 'id_mark',
              label: BtnMarkAll,
              functionName: 'markAll'
            });
            SubTabla.addButton({
              id: 'id_desmark',
              label: BtnDesmarkAll,
              functionName: 'desmarkAll'
            });

            //BUSQUEDA DE BILL CREDITS
            //modificacion argentina
            var licenses = allLicenses[Rd_SubId] || [];
            if (library.getAuthorization(675, licenses) && (Rd_AccId == null || Rd_AccId == "" || Rd_AccId == 0)) {
              var search_billcredit = search.create({
                type: 'vendorcredit',
                filters: [
                  ['subsidiary', 'anyof', Rd_SubId], "AND", ['currency', 'anyof', Rd_CurId], "AND",
                  ['mainline', 'is', true], "AND", ["formulatext: {appliedtoforeignamount}", "isnotempty", ""], "AND",
                  ['custbody_lmry_wht_details', 'anyof', '@NONE@']
                ],
                columns: [{
                    name: 'internalid',
                    sort: search.Sort.DESC
                  }, {
                    name: 'custrecord_lmry_transaction_f_exento',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  },
                  {
                    name: 'custrecord_lmry_transaction_f_iva',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  }, {
                    name: 'custrecord_lmry_transaction_f_gravado',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  },
                  {
                    name: 'custrecord_lmry_transaction_f_no_gravado',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  }, {
                    name: 'internalid',
                    join: 'appliedToTransaction'
                  }, 'appliedtoforeignamount', {
                    name: 'internalid',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  }, 'custbody_lmry_es_detraccion'
                ]

              });
            } else {
              var search_billcredit = search.create({
                type: 'vendorcredit',
                filters: [
                  ['subsidiary', 'anyof', Rd_SubId], "AND", ['currency', 'anyof', Rd_CurId], "AND", ['account', 'anyof', Rd_AccId], "AND",
                  ['mainline', 'is', true], "AND", ["formulatext: {appliedtoforeignamount}", "isnotempty", ""], "AND",
                  ['custbody_lmry_wht_details', 'anyof', '@NONE@']
                ],
                columns: [{
                    name: 'internalid',
                    sort: search.Sort.DESC
                  }, {
                    name: 'custrecord_lmry_transaction_f_exento',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  },
                  {
                    name: 'custrecord_lmry_transaction_f_iva',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  }, {
                    name: 'custrecord_lmry_transaction_f_gravado',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  },
                  {
                    name: 'custrecord_lmry_transaction_f_no_gravado',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  }, {
                    name: 'internalid',
                    join: 'appliedToTransaction'
                  }, 'appliedtoforeignamount', {
                    name: 'internalid',
                    join: 'CUSTRECORD_LMRY_TRANSACTION_F'
                  }, 'custbody_lmry_es_detraccion'
                ]

              });
            }

            var c = 0;
            var result_billcredit_run = search_billcredit.run();
            var result_billcredit = result_billcredit_run.getRange({
              start: c,
              end: c + 1000
            });

            var jsonCredit = {};

            if (result_billcredit != null && result_billcredit.length > 0) {
              var flag_billcredit = true;
              while (flag_billcredit) {
                for (var i = 0; i < result_billcredit.length; i++) {
                  var columnas = result_billcredit[0].columns;

                  var idBill = result_billcredit[i].getValue(columnas[5]);
                  var idCredit = result_billcredit[i].getValue(columnas[0]);
                  if (!jsonCredit.hasOwnProperty(idBill)) {
                    jsonCredit[idBill] = {};
                  }

                  jsonCredit[idBill][idCredit] = {
                    'amount': Math.abs(parseFloat(result_billcredit[i].getValue(columnas[6]))),
                    'exento': result_billcredit[i].getValue(columnas[1]) || 0,
                    'iva': result_billcredit[i].getValue(columnas[2]) || 0,
                    'gravado': result_billcredit[i].getValue(columnas[3]) || 0,
                    'nogravado': result_billcredit[i].getValue(columnas[4]) || 0,
                    'anticipo': result_billcredit[i].getValue(columnas[8])
                  };

                }

                if (result_billcredit.length == 1000) {
                  c = c + 1000;
                  result_billcredit = result_billcredit_run.getRange({
                    start: c,
                    end: c + 1000
                  });
                } else {
                  flag_billcredit = false;
                }
              }
            }

            //BUSQUEDA DE BILLS
            var filtros_bill = [];
            filtros_bill.push(search.createFilter({
              name: 'currency',
              operator: 'anyof',
              values: Rd_CurId
            }));
            //modificacion argentina
            if (!library.getAuthorization(675, licenses) || (Rd_AccId != null && Rd_AccId != "" && Rd_SubId != 0)) {
              filtros_bill.push(search.createFilter({
                name: 'account',
                operator: 'anyof',
                values: Rd_AccId
              }));
            }

            filtros_bill.push(search.createFilter({
              name: 'duedate',
              operator: 'onorafter',
              values: Rd_FroId
            }));
            filtros_bill.push(search.createFilter({
              name: 'duedate',
              operator: 'onorbefore',
              values: Rd_TooId
            }));
            filtros_bill.push(search.createFilter({
              name: 'paymenthold',
              operator: 'is',
              values: 'F'
            }));

            if (category) {
              filtros_bill.push(search.createFilter({
                name: 'vendtype',
                operator: 'anyof',
                values: Rd_CatId
              }));

            }
            if (subsi_OW) {
              filtros_bill.push(search.createFilter({
                name: 'subsidiary',
                operator: search.Operator.ANYOF,
                values: Rd_SubId
              }));
            }

            // Busqueda personalizada : LatamReady - WHT Vendor Bill
            var search_transac = search.load({
              id: 'customsearch_lmry_wht_vendor_bill'
            });

            var help = form.addField({
              id: 'custpage_id_help',
              type: serverWidget.FieldType.TEXT,
              label: LblHelp
            }).updateDisplayType({
              displayType: 'hidden'
            });
            var billsDataField = form.addField({
              id: "custpage_bills_data",
              type: serverWidget.FieldType.LONGTEXT,
              label: "Data Bills"
            });

            billsDataField.updateDisplayType({
              displayType: "hidden"
            });

            //BUSQUEDA DE BILLS
            for (var i = 0; i < filtros_bill.length; i++) {
              search_transac.filters.push(filtros_bill[i]);
            }


            var billsSublistData = {};

            if (bank_details != null && bank_details != '') {
              var load_vendor = record.create({
                type: 'vendor'
              });
              load_vendor = load_vendor.getField({
                fieldId: bank_details
              });

              if (load_vendor != null && load_vendor != '') {
                help.defaultValue = bank_details;
                search_transac.columns.push(search.createColumn({
                  name: bank_details,
                  join: 'vendor'
                }));
              }
            }

            var result_transac = search_transac.run().getRange({
              start: 0,
              end: 1000
            });
            if (result_transac != null && result_transac.length > 0) {
              for (var i = 0; i < result_transac.length; i++) {
                var searchresult = result_transac[i];
                // para usar campos de tipo formula
                var colFields = result_transac[i].columns;
                var exchan_rate = "" + searchresult.getValue({
                  name: colFields[5]
                });
                var intid = "" + searchresult.getText({
                  name: colFields[0]
                });
                var doc_fiscal = "" + searchresult.getValue({
                  name: colFields[12]
                });
                if (doc_fiscal != "") {
                  SubTabla.setSublistValue({
                    id: 'id_doc',
                    line: i,
                    value: doc_fiscal
                  });
                }
                if (intid != "") {
                  SubTabla.setSublistValue({
                    id: 'id_int',
                    line: i,
                    value: intid
                  });
                }



                var cdate = "" + searchresult.getValue({
                  name: colFields[10]
                });
                if (cdate != "") {
                  SubTabla.setSublistValue({
                    id: 'id_date',
                    line: i,
                    value: cdate
                  });
                }
                var namev = "" + searchresult.getValue({
                  name: colFields[1]
                });

                if (namev != "") {
                  SubTabla.setSublistValue({
                    id: 'id_vend',
                    line: i,
                    value: namev
                  });
                }

                var namet = "" + searchresult.getValue({
                  name: colFields[7]
                });

                if (namet != "") {
                  SubTabla.setSublistValue({
                    id: 'id_tran',
                    line: i,
                    value: namet
                  });
                }

                var exchang = "" + searchresult.getValue({
                  name: colFields[5]
                });
                if (exchang != "") {
                  SubTabla.setSublistValue({
                    id: 'id_exch',
                    line: i,
                    value: exchang
                  });
                }

                var am_total = "" + searchresult.getValue({
                  name: colFields[8]
                });
                if (am_total != "") {
                  SubTabla.setSublistValue({
                    id: 'id_tota',
                    line: i,
                    value: am_total
                  });
                }

                var amure = "" + searchresult.getValue({
                  name: colFields[6]
                });

                if (amure != "") {
                  amure = "" + searchresult.getValue({
                    name: colFields[13]
                  });
                  //amure = parseFloat(amure);
                  SubTabla.setSublistValue({
                    id: 'id_amou',
                    line: i,
                    value: amure
                  });
                }

                SubTabla.setSublistValue({
                  id: 'id_cred',
                  line: i,
                  value: 0
                });

                if (jsonCredit.hasOwnProperty(intid)) {

                  var totalAmount = 0;
                  for (var j in jsonCredit[intid]) {
                    totalAmount += parseFloat(jsonCredit[intid][j]['amount']);
                  }

                  SubTabla.setSublistValue({
                    id: 'id_cred',
                    line: i,
                    value: totalAmount
                  });
                  SubTabla.setSublistValue({
                    id: 'id_json',
                    line: i,
                    value: JSON.stringify(jsonCredit[intid])
                  });

                }
                var account = "" + searchresult.getValue({
                  name: colFields[14]
                });
                if (account != "") {
                  SubTabla.setSublistValue({
                    id: 'id_account',
                    line: i,
                    value: account
                  });
                }

                if (!billsSublistData.hasOwnProperty(intid)) {
                  billsSublistData[intid] = {
                    id: intid
                  };
                }

                if (colFields[15]) {
                  var checkBankDetails = searchresult.getValue({
                    name: colFields[15]
                  }) || "";
                  if (billsSublistData.hasOwnProperty(intid)) {
                    billsSublistData[intid].checkBankDetails = checkBankDetails;
                  }
                }
              }

              billsDataField.defaultValue = JSON.stringify(billsSublistData);
            }
          }

          // Script Cliente
          form.clientScriptModulePath = './WTH_Library/LMRY_WHT_Massive_Payments_CLNT.js';

          // Seteo en el rellamado
          if (Rd_CurId != '' && Rd_CurId != null) {
            log.error('BtnSave', BtnSave);
            log.error('BtnBack', BtnBack);
            form.addSubmitButton({
              label: BtnSave
            });
            form.addButton({
              id: 'id_cancel',
              label: BtnBack,
              functionName: 'funcionCancel'
            });
          } else {
            form.addSubmitButton({
              label: BtnFiltrar
            });
          }
          form.addResetButton({
            label: BtnReset
          });

          // Dibuja el fomulario
          context.response.writePage(form);
        } else {
          var _estado = context.request.parameters.id_state;

          if (_estado == '' || _estado == null) {
            var subsi_OW = runtime.isFeatureInEffect({
              feature: "SUBSIDIARIES"
            });
            var subsi = '1';
            if (subsi_OW) {
              subsi = context.request.parameters.custpage_id_subsi;
            }
            // realiza la consulta con los parametros seleccionados
            redirect.toSuitelet({
              scriptId: runtime.getCurrentScript().id,
              deploymentId: runtime.getCurrentScript().deploymentId,
              parameters: {
                'custparam_subsi': subsi,
                'custparam_curre': context.request.parameters.custpage_id_curren,
                'custparam_accon': context.request.parameters.custpage_id_account_pay,
                'custparam_date': context.request.parameters.custpage_id_date,
                'custparam_bacco': context.request.parameters.custpage_id_bank,
                'custparam_acper': context.request.parameters.custpage_id_period,
                'custparam_exrat': context.request.parameters.custpage_id_rate,
                'custparam_depar': context.request.parameters.custpage_id_depart,
                'custparam_class': context.request.parameters.custpage_id_class,
                'custparam_locat': context.request.parameters.custpage_id_location,
                'custparam_metho': context.request.parameters.custpage_id_method,
                'custparam_categ': context.request.parameters.custpage_id_category,
                'custparam_datef': context.request.parameters.custpage_id_datefrom,
                'custparam_datet': context.request.parameters.custpage_id_dateto,
              }
            });

          } else {
            var massiveLogs = context.request.parameters.custpage_data_log || "";
            if (massiveLogs) {
              log.debug("massiveLogs", massiveLogs);
              massiveLogs = JSON.parse(massiveLogs);
              var _date = context.request.parameters.custpage_id_date;
              log.debug("_date", _date);
              _date = format.parse({
                value: _date,
                type: format.Type.DATE
              });

              //ejecutando el post del suitelet principal
              log.error({
                title: 'Estado',
                details: 'Envio al Preview'
              });
              var usuario = runtime.getCurrentUser().id;
              var subsi_OW = runtime.isFeatureInEffect({
                feature: "SUBSIDIARIES"
              });
              var massiveIds = [];

              for (var i = 0; i < massiveLogs.length; i++) {
                var massiveLogObj = massiveLogs[i];
                var wht_massive = record.create({
                  type: 'customrecord_lmry_wht_massive_payments',
                  isDynamic: true
                });
                wht_massive.setValue({
                  fieldId: 'custrecord_lmry_wht_massive_status',
                  value: 'Preview'
                });
                //var _date = new Date(massiveLogObj.date);
                wht_massive.setValue({
                  fieldId: 'custrecord_lmry_wht_massive_date',
                  value: _date
                });
                wht_massive.setValue({
                  fieldId: 'custrecord_lmry_wht_massive_subsi',
                  value: massiveLogObj.subsidiary
                });
                wht_massive.setValue({
                  fieldId: 'custrecord_lmry_wht_massive_acc_period',
                  value: massiveLogObj.period
                });
                wht_massive.setValue({
                  fieldId: 'custrecord_lmry_wht_massive_currency',
                  value: massiveLogObj.currency
                });
                wht_massive.setValue({
                  fieldId: 'custrecord_lmry_wht_massive_rate',
                  value: massiveLogObj.rate
                });
                wht_massive.setValue({
                  fieldId: 'custrecord_lmry_wht_massive_document',
                  value: massiveLogObj.document || ""
                });
                wht_massive.setValue({
                  fieldId: 'custrecord_lmry_wht_massive_pay_method',
                  value: massiveLogObj.method || ""
                });

                if (massiveLogObj.mbook) {
                  wht_massive.setValue({
                    fieldId: 'custrecord_lmry_wht_massive_multibooking',
                    value: massiveLogObj.mbook
                  });
                }

                var massiveId = wht_massive.save({
                  enableSourcing: false,
                  ignoreMandatoryFields: true,
                  disableTriggers: true
                });
                massiveIds.push(massiveId);

                var s_log = "";
                var s_vendor = "";

                if (massiveLogObj.individualLogs && massiveLogObj.individualLogs.length) {
                  for (var j = 0; j < massiveLogObj.individualLogs.length; j++) {
                    var logObj = massiveLogObj.individualLogs[j];
                    var wht_log = record.create({
                      type: 'customrecord_lmry_wht_payments_log',
                      isDynamic: true
                    });

                    if (logObj.mbook) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_mul',
                        value: logObj.mbook
                      });
                    }

                    if (logObj.subsidiary) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_sub',
                        value: logObj.subsidiary
                      });
                    }

                    var vendor = logObj.vendor;

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_ven',
                      value: logObj.vendor || ""
                    });
                    if (logObj.credits) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_cre',
                        value: JSON.stringify(logObj.credits)
                      });
                    }

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_bil',
                      value: logObj.bills
                    });

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_doc',
                      value: logObj.docs
                    });

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_acc',
                      value: logObj.account
                    });

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_cur',
                      value: logObj.currency
                    });

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_ban',
                      value: logObj.bankAcc
                    });

                    //var _date = new Date(logObj.date)
                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_dat',
                      value: _date
                    });

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_per',
                      value: logObj.period
                    });

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_exc',
                      value: logObj.rate
                    });

                    if (logObj.eft) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_eft',
                        value: logObj.eft
                      });
                    }

                    if (logObj.memo) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_mem',
                        value: logObj.memo
                      });
                    }
                    var department = logObj.department || "";
                    department = Number(department);
                    if (department) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_dep',
                        value: department
                      });
                    }

                    var location = logObj.location || "";
                    location = Number(location);
                    if (location) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_loc',
                        value: location
                      });
                    }

                    var _class = logObj.cla || ""
                    _class = Number(_class);
                    if (_class) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_cla',
                        value: _class
                      });
                    }

                    if (massiveId) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_mas',
                        value: massiveId
                      });
                    }

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_met',
                      value: logObj.method || ""
                    });

                    var dateFrom = new Date(logObj.dateFrom);

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_fro',
                      value: dateFrom
                    });

                    var dateTo = new Date(logObj.dateTo);

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_too',
                      value: dateTo
                    });

                    if (logObj.category) {
                      wht_log.setValue({
                        fieldId: 'custrecord_lmry_wht_cat',
                        value: logObj.category
                      });
                    }

                    wht_log.setValue({
                      fieldId: 'custrecord_lmry_wht_sta',
                      value: 'Pendiente de proceso'
                    });

                    // Graba Log
                    var logId = wht_log.save({
                      enableSourcing: false,
                      ignoreMandatoryFields: true,
                      disableTriggers: true
                    });

                    s_log += logId + "|";
                    s_vendor += vendor + "|";
                  }
                }

                record.submitFields({
                  type: 'customrecord_lmry_wht_massive_payments',
                  id: massiveId,
                  values: {
                    custrecord_lmry_wht_massive_payments_log: s_log,
                    custrecord_lmry_wht_massive_vendors: s_vendor
                  },
                  options: {
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                  }
                });
              }

              log.debug("massiveIds", JSON.stringify(massiveIds));

              // realiza la consulta con los parametros seleccionados
              if (massiveIds.length == 1) {
                redirect.toSuitelet({
                  scriptId: 'customscript_lmry_wht_massive_deta_stlt',
                  deploymentId: 'customdeploy_lmry_wht_massive_deta_stlt',
                  parameters: {
                    'param_logid': massiveIds[0],
                    'param_useid': usuario
                  }
                });
              }
              if (massiveIds.length > 1) {
                redirect.toSuitelet({
                  scriptId: 'customscript_lmry_ar_wht_masivo_det_stl',
                  deploymentId: 'customdeploy_lmry_ar_wht_masivo_det_stl',
                  parameters: {
                    'param_logid': massiveIds.join(","),
                    'param_useid': usuario
                  }
                });
              }
            }
          }
        }
      } catch (msgerr) {

        var form = serverWidget.createForm({
          title: LblForm
        });
        var myInlineHtml = form.addField({
          id: 'custpage_id_message',
          label: LblTittleMsg,
          type: serverWidget.FieldType.INLINEHTML
        });
        myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
        myInlineHtml.updateBreakType({
          breakType: serverWidget.FieldBreakType.STARTCOL
        });

        var strhtml = "<html>";
        strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
        strhtml += "<tr>";
        strhtml += "</tr>";
        strhtml += "<tr>";
        strhtml += "<td class='text'>";
        strhtml += "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">";
        strhtml += LblMsg3 + ".<br><br>";
        strhtml += "<br>Code :" + xml.escape(msgerr.name);
        strhtml += "<br>Details :" + xml.escape(msgerr.message);
        strhtml += "</div>";
        strhtml += "</td>";
        strhtml += "</tr>";
        strhtml += "</table>";
        strhtml += "</html>";

        // Mensaje HTML
        myInlineHtml.defaultValue = strhtml;

        // Dibuja el Formulario
        context.response.writePage(form);
        log.error({
          title: 'Se generó un error en suitelet',
          details: msgerr
        });

        lbryLog.doLog({
          title: "[ onRequest ]",
          message: msgerr
        });

        // Envio de mail al clientes
        library.sendemail('[onRequest] ' + msgerr, LMRY_script);
      }
    }

    return {
      onRequest: onRequest
    };

  });
