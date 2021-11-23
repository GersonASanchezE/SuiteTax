/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BoletoBancarioBOALBRY_V2.0.js               ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 17 2019  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/record', 'N/file', 'N/record', 'N/render', 'N/url', 'N/log', 'N/xml', 'N/https', 'N/search', 'N/runtime', 'N/format', 'N/format/i18n', 'N/config', './LMRY_libSendingEmailsLBRY_V2.0'],
  function(record, file, record, render, url, log, xml, https, search, runtime, format, format2, config, libraryMail) {

    var LMRY_script = 'LMRY_BoletoBancarioBOALBRY_V2.0.js';
    var ST_FEATURE = false;

    //Datos de la Subsidiaria/Beneficiario
    var nomSubsidiaria = '';
    var cnpjSubsidiaria = '';
    var addressSubsidiaria = '';

    //Datos del Customer/Pagador
    var nomCustomer = '';
    var cnpjCustomer = '';
    var addressCustomer = '';

    //Datos del Invoice
    var dateInvoice = '';
    var dueDateInvoice = '';
    var dataVencimiento = '';
    var montoTotalInvoiceValue = '';
    var montoTotalInvoiceText = ''; //Valor do Documento
    var tranidInvoice = '';

    //Datos de la URL del archivo
    var url_logo = '';
    var host = '';

    var nossoNum = '';
    var especieDoc = '';
    var numDocumento = '';

    //Datos config: Subsidiaria - Bank BOA
    var agenciaCodBeneficiario = '';
    var codigoBeneficiario = '';
    var cartera = '';
    var codigoBanco = '';
    var aceptacion = '';
    var codigoEntrega = '';
    var lugarPago = '';
    var digitoVerificadorBanco = '';
    var id_logoBankOfAmerica = '';

    var especieMoneda = '';
    var instructions = '';
    var fechaProcesamiento = '';

    var codigoBarras = '';
    var codigoMoneda = '';
    var lineaDigital = '';

    var etiquetaCNPJ = '';
    var anulado = '';
    var codOcurencia = '';

    /* Variables para el campo personalizado que puede contener:
    ID de campos de tipo custbody,Texto libre y salto de linea(enter)*/
    var custom_field = '';
    var instrucciones = '';
    var licenses = [];
    var id_folder_br_ei = '';
    var flag = false;
    var boletos = [];

    //Url de web service acortador de link
    const WS_URL = 'https://tstdrv1930452.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=692&deploy=1&compid=TSTDRV1930452&h=42860c3b2ce293fa7084';


    function obtenerURLPdfBoletoBancario(id_invoice, configBoleto, status, param_fecha, installment, type) {
      try {
        codOcurencia = status;
        var Language = runtime.getCurrentScript().getParameter({
          name: 'LANGUAGE'
        });
        Language = Language.substring(0, 2);

        switch (Language) {
          case 'pt':
            anulado = '<p valign="middle" align="center" rotate="-60" style="font-size:150px;color:alpha(8%,#ff0000)">PEDIDO DE BAIXA</p>';
            break;
          case 'es':
            anulado = '<p valign="middle" align="center" rotate="-60" style="font-size:140px;color:alpha(8%,#ff0000)">SOLICITUD DE BAJA</p>';
            break;
          default:
            anulado = '<p valign="middle" align="center" rotate="-60" style="font-size:130px;color:alpha(8%,#ff0000)">WRITE OFF REQUEST</p>';
        }

        /************************************* MODIFICACIÓN ***********************************************************
         - Fecha: 06/04/2020
         - Descripción: Mejora de performance
        ***************************************************************************************************************/

        var recordInvoice = search.lookupFields({
          type: search.Type.INVOICE,
          id: id_invoice,
          columns: ['subsidiary', 'entity', 'internalid', 'tranid', 'trandate', 'duedate', 'fxamount', 'custbody_lmry_wtax_code_des', 'custbody_lmry_wtax_amount', 'currency']
        });

        var subsidiary = recordInvoice.subsidiary[0].value;

        var customer = recordInvoice.entity[0].value;

        var idInvoice = recordInvoice.internalid[0].value;

        tranidInvoice = recordInvoice.tranid;

        dateInvoice = recordInvoice.trandate;

        dateInvoice = formatoFecha(dateInvoice);

        dataVencimiento = recordInvoice.duedate;

        if (dataVencimiento) {
          dueDateInvoice = formatoFecha(dataVencimiento);
        }

        montoTotalInvoiceValue = recordInvoice.fxamount;

        /************************************* MODIFICACIÓN ***********************************************************
         - Fecha: 06/04/2020
         - Descripción: Añadir formato a monto y modificación en el cálculo del monto
        ***************************************************************************************************************/

        var numberMonto = format.parse({
          value: montoTotalInvoiceValue,
          type: format.Type.FLOAT
        });

        var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
        montoTotalInvoiceText = numFormatter1.format({
          number: numberMonto
        });


        licenses = libraryMail.getLicenses(subsidiary);

        /************************************* MODIFICACIÓN ***********************************************************
         - Fecha: 28/02/2020
         - Descripción: Si esta activo el Feature  BR - LATAM WHT TAX y el campo tax_code_des tiene la descripción
           Latam - WHT Tax , Se resta el monto del invoice con el monto de la retencion (ID:custbody_lmry_wtax_amount)
        ***************************************************************************************************************/
        var tax_code_des = recordInvoice.custbody_lmry_wtax_code_des;

        if (libraryMail.getAuthorization(416, licenses) == true && tax_code_des == 'Latam - WHT Tax') {
          flag = true;
          var retencion = recordInvoice.custbody_lmry_wtax_amount;
          montoTotalInvoiceValue = montoTotalInvoiceValue - retencion;
          var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
          montoTotalInvoiceText = numFormatter1.format({
            number: montoTotalInvoiceValue
          });
          montoTotalInvoiceValue = montoTotalInvoiceValue.toFixed(2);
        }
        // ********************************************FIN MODIFICACIÓN ***********************************************

        var moneda = recordInvoice.currency[0].value;

        var tranid_invoice = recordInvoice.tranid;

        // 10 caracteres desde la izquierda
        tranid_invoice = tranid_invoice.substring(tranid_invoice.length - 10, tranid_invoice.length);
        tranid_invoice = tranid_invoice.trim();

        numDocumento = tranid_invoice;
        // numDocumento = idInvoice; // Internal ID de la transaccion
        var fecha_actual = new Date();

        if (param_fecha == 1) {
          fechaProcesamiento = dateInvoice;
        } else if (param_fecha == 2) {
          fechaProcesamiento = formatoFecha(fecha_actual);
        }

        obtenerDatosSubsidiaria(subsidiary, id_invoice);
        obtenerDatosCustomer(customer, id_invoice);
        obtenerDatosConfigSubsidiariaBancoBOA(subsidiary, moneda, configBoleto);
        instrucciones = formandoInstrucciones(id_invoice);

        //validando que las instrucciones del Boleto Bancario tenga solo 160 caracteres
        var caracteresInstruccion = tranidInvoice + " " + instrucciones;
        if (caracteresInstruccion.length <= 160) {
          instructions = caracteresInstruccion;
        } else {
          instructions = caracteresInstruccion.substring(0, 160);
        }
        //fin validacion de las instrucciones

        host = url.resolveDomain({
          hostType: url.HostType.APPLICATION
        });

        if (id_logoBankOfAmerica != '' && id_logoBankOfAmerica != null) {
          url_logo = 'https://' + host + file.load(id_logoBankOfAmerica).url;
        } else {
          url_logo = 'https://tstdrv1038915.app.netsuite.com/core/media/media.nl?id=1875&c=TSTDRV1038915&h=d3e77a0d32a74588b3f6';
        }

        //Crea la carpeta "Latam BR - PDF Boleto Bancario" si no existe, en dicha carpeta se guardaran los Boletos Bancarios
        search_folder();

        boletos = formarInstallments(id_invoice, installment, type);

        return boletos;
      } catch (err) {
        libraryMail.sendemail(' [ obtenerURLPdfBoletoBancarioBOA ] ' + err, LMRY_script);
      }
    }

    function formarInstallments(id_invoice, installment, type) {
      try {
        var linkBoleto = '';
        var arrayBoletos = [];
        //Se obtiene el Id de la carpeta "Latam BR - PDF Boleto Bancario"
        id_folder_br_ei = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_boleto_bancario'
        });
        if (id_folder_br_ei) {

          var installments = runtime.isFeatureInEffect({
            feature: "installments"
          });

          linkBoleto = formarPDF(montoTotalInvoiceValue, montoTotalInvoiceText, '', id_invoice);
          arrayBoletos.push(linkBoleto);

          if (installments && libraryMail.getAuthorization(536, licenses)) {

            var jsonInstallments = [];

            if (installment != '' && installment != null) {
              jsonInstallments = JSON.parse(installment);
            }

            if (Object.keys(jsonInstallments).length) {
              for (var idInstallment in jsonInstallments) {
                var monto = Math.round(parseFloat(jsonInstallments[idInstallment]['amount']) * 100) / 100;

                if (jsonInstallments[idInstallment]['wht'] && flag) {
                  var retencion = Math.round(parseFloat(jsonInstallments[idInstallment]['wht']) * 100) / 100;
                  retencion = retencion.toFixed(2);
                  monto = Math.round((parseFloat(monto) - parseFloat(retencion)) * 100) / 100;
                }

                var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
                montoText = numFormatter1.format({
                  number: monto
                });

                monto = monto.toFixed(2);

                if (jsonInstallments[idInstallment]['duedate']) {
                    dataVencimiento = jsonInstallments[idInstallment]['duedate'];
                    dueDateInvoice = formatoFecha(dataVencimiento);
                }

                var link = formarPDF(monto, montoText, idInstallment, id_invoice);
                arrayBoletos.push(link);
              }
            } else {

              var searchInstallments = search.create({
                    type: "invoice",
                    filters:
                        [
                            ["internalid", "anyof", id_invoice], "AND",
                            ["mainline", "is", "T"]
                        ],
                    columns: [
                        search.createColumn({
                            name: "installmentnumber",
                            join: "installment",
                            sort: search.Sort.ASC
                        }),
                        "installment.amount",
                        "installment.duedate"
                    ],
                    settings: [search.createSetting({ name: 'consolidationtype', value: 'NONE' })]
                });

              var resultInstallments = searchInstallments.run().getRange(0, 100);

              var row = resultInstallments[0].columns;
              var installNumber = resultInstallments[0].getValue(row[0]);

              if (resultInstallments != null && resultInstallments != '' && installNumber != '' && installNumber!= null) {
                for (var i = 0; i < resultInstallments.length; i++) {
                  var row = resultInstallments[i].columns;
                  var internalId = resultInstallments[i].getValue(row[0]);
                  var monto = resultInstallments[i].getValue(row[1]);
                  var duedate = resultInstallments[i].getValue(row[2]);
                  monto = parseFloat(monto);

                  //Parseando el monto a float
                  var numberMonto = format.parse({
                    value: monto,
                    type: format.Type.FLOAT
                  });

                  var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
                  var montoText = numFormatter1.format({
                    number: numberMonto
                  });

                  monto = monto.toFixed(2);

                  if(duedate){
                    dataVencimiento = duedate;
                    dueDateInvoice = formatoFecha(dataVencimiento);
                  }

                  var link = formarPDF(monto, montoText, internalId, id_invoice);
                  arrayBoletos.push(link);

                }
              }
            }
          }

          if (type == '1') {
            record.submitFields({
              type: 'invoice',
              id: id_invoice,
              values: {
                'custbody_lmry_informacion_adicional': arrayBoletos
              },
              options: {
                ignoreMandatoryFields: true,
                enableSourcing: true,
                disableTriggers: true
              }
            });
          }
          //}

          return arrayBoletos;
        }
      } catch (err) {
        libraryMail.sendemail(' [ formarInstallments ] ' + err, LMRY_script);
      }
    }

    function formarPDF(monto, montoText, cod, id_invoice) {
      try {
        var shortLink = '';
        nossoNum = formandoNossoNumero(id_invoice, cod);
        codigoBarras = obtenerCodigoBarras(monto);
        lineaDigital = obtenerLineaDigital(codigoBarras);

        var htmlFinal = '';
        htmlFinal += reciboPagador(montoText);
        htmlFinal += ".............................................................................................................................................................................."
        htmlFinal += fichaCompensacion(montoText);

        var xml = "<?xml version=\"1.0\"?><!DOCTYPE pdf PUBLIC \"-//big.faceless.org//report\" \"report-1.1.dtd\">";
        xml += "<pdf> <head> <macrolist><macro id=\"marca\">" + anulado + "</macro></macrolist>";
        if (codOcurencia == 2) {
          xml += "</head><body font-size=\"12\" size=\"A4\" background-macro=\"marca\"><h3></h3>";
        } else {
          xml += "</head><body font-size=\"12\" size=\"A4\"><h3></h3>";
        }
        xml += htmlFinal;
        xml += "</body> </pdf>";

        var myFileObj = render.xmlToPdf({
          xmlString: xml
        });

        //Nombre del Boleto Bancario
        if (cod != '') {
          myFileObj.name = 'BR_BB_' + id_invoice + '_' + cod + '.pdf';
        } else {
          myFileObj.name = 'BR_BB_' + id_invoice + '.pdf';
        }

        myFileObj.folder = id_folder_br_ei;
        myFileObj.isOnline = true;
        var id_pdf = myFileObj.save();

        var url_archivo_pdf = file.load({
          id: id_pdf
        });
        var urlBoletoBancarioPdf = 'https://' + host + url_archivo_pdf.url;

        //Acortador del link
        var account = runtime.accountId;
        shortLink = libraryMail.acortadorDeLink(WS_URL, urlBoletoBancarioPdf, account);
        return shortLink;

      } catch (err) {
        libraryMail.sendemail(' [ formarPDF ] ' + err, LMRY_script);
      }
    }

    function obtenerDatosConfigSubsidiariaBancoBOA(id_subsidiaria, currency, configBoleto) {
      //busqueda del record customrecord_lmry_br_config_bank_ticket para la config: Subsiiaria - BOA
      var searchConfigSubsiBank = search.create({
        type: 'customrecord_lmry_br_config_bank_ticket',
        columns: [{
          name: 'custrecord_lmry_name_subsidiary'
        }, {
          name: 'custrecord_lmry_beneficiary_code'
        }, {
          name: 'custrecord_lmry_code_bank'
        }, {
          name: 'custrecord_lmry_bank_agency'
        }, {
          name: 'custrecord_lmry_bank_place_of_payment'
        }, {
          name: 'custrecord_lmry_bank_code_cartera'
        }, {
          name: 'custrecord_lmry_bank_code_delivery'
        }, {
          name: 'custrecord_lmry_bank_accept_bank_ticket'
        }, {
          name: 'custrecord_lmry_bank_check_digit'
        }, {
          name: 'custrecord_lmry_br_docu_specie_siglas',
          join: 'CUSTRECORD_LMRY_BANK_ESPECIE_DOC'
        }, {
          name: 'custrecord_lmry_label_cnpj'
        }, {
          name: 'internalid'
        }, {
          name: 'custrecord_lmry_id_field'
        }, {
          name: 'custrecord_lmry_bank_logo'
        }],
        filters: ['internalid', 'is', configBoleto]
      });
      var searchResult = searchConfigSubsiBank.run().getRange(0, 1);

      if (searchResult != '' && searchResult != null) {
        var columns_config = searchResult[0].columns;

        codigoBeneficiario = searchResult[0].getValue({
          name: 'custrecord_lmry_beneficiary_code'
        });
        codigoBanco = searchResult[0].getValue({
          name: 'custrecord_lmry_code_bank'
        });
        var agencia = searchResult[0].getValue({
          name: 'custrecord_lmry_bank_agency'
        });

        if(codigoBeneficiario){
          codigoBeneficiario = codigoBeneficiario.toString();
          while (codigoBeneficiario.length < 12) {
            codigoBeneficiario = "0" + codigoBeneficiario
          }
          if (codigoBeneficiario.length  > 12) {
            codigoBeneficiario = codigoBeneficiario.substring(0, 12);
          }
        }

        if (agencia) {
          agenciaCodBeneficiario = agencia + " / " + codigoBeneficiario;

        } else {
          agenciaCodBeneficiario = codigoBeneficiario;
        }


        lugarPago = searchResult[0].getValue({
          name: 'custrecord_lmry_bank_place_of_payment'
        });
        cartera = searchResult[0].getValue({
          name: 'custrecord_lmry_bank_code_cartera'
        });
        codigoEntrega = searchResult[0].getValue({
          name: 'custrecord_lmry_bank_code_delivery'
        });
        aceptacion = searchResult[0].getValue({
          name: 'custrecord_lmry_bank_accept_bank_ticket'
        });
        if (aceptacion == 1) {
          aceptacion = "A";
        } else {
          aceptacion = "NAO";

        }
        especieDoc = searchResult[0].getValue(columns_config[9]);

        digitoVerificadorBanco = searchResult[0].getValue({
          name: 'custrecord_lmry_bank_check_digit'
        });

        etiquetaCNPJ = searchResult[0].getValue({
          name: 'custrecord_lmry_label_cnpj'
        });
        if (etiquetaCNPJ == 1) {
          etiquetaCNPJ = " CNPJ: ";
        } else {
          etiquetaCNPJ = " ";

        }

        //Campo personalizado para la impresión en las instrucciones del PDF, que puede contener: ID de campos de tipo custbody, Texto libre y salto de linea(enter)
        custom_field = searchResult[0].getValue({
          name: 'custrecord_lmry_id_field'
        });

        //campo para el Logo de Bank Of America
        id_logoBankOfAmerica = searchResult[0].getValue({
          name: 'custrecord_lmry_bank_logo'
        });

        var id_config_bank_ticket = searchResult[0].getValue({
          name: 'internalid'
        });

        var searchConfigCurrency = search.create({
          type: 'customrecord_lmry_br_config_currency',
          columns: [{
            name: 'custrecord_lmry_br_config_currency_name'
          }, {
            name: 'custrecord_lmry_br_config_currency_cod'
          }, {
            name: 'custrecord_lmry_br_config_currency_form'
          }],
          filters: ['custrecord_lmry_br_config_currency_bank', 'is', id_config_bank_ticket]
        });
        var searchResultCurrency = searchConfigCurrency.run().getRange(0, 1000);
        if (searchResultCurrency != '' && searchResultCurrency != null) {
          for (var j = 0; j < searchResultCurrency.length; j++) {

            var name_currency = searchResultCurrency[j].getValue({
              name: 'custrecord_lmry_br_config_currency_name'
            });


            if (name_currency == currency) {
              var code_currency = searchResultCurrency[j].getValue({
                name: 'custrecord_lmry_br_config_currency_cod'
              });
              var format_currency = searchResultCurrency[j].getValue({
                name: 'custrecord_lmry_br_config_currency_form'
              });
              codigoMoneda = code_currency;
              especieMoneda = format_currency;

            }
          }

        }
      }
    }

    function reciboPagador(monto) {
      var html = "";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center; margin-top:25px\">";
      html += "<tr>";
      html += "<td valign=\"bottom\" align=\"left\"> <img  src=\"" + xml.escape(url_logo) + "\" width=\"120\" height=\"23\"/>  </td>";
      html += "<td></td>";
      html += "<td valign=\"bottom\" style=\"font-size:5pt\" align=\"right\">RECIBO DO PAGADOR </td>";
      html += "</tr>";
      html += "</table>";


      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center; border-top:1px;border-left:1px; \">";
      html += "<tr style=\"border-right:1px;\">";
      html += "<td style=\"font-size:6pt; \">Nome do Beneficiário</td>";
      html += "<td style=\"border-right:1px;\" colspan=\"3\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 9pt; \" align=\"left\" colspan=\"2\">" + nomSubsidiaria + "</td>";
      html += "<td style=\"font-size: 9pt;border-right:1px; \" align=\"left\" colspan=\"2\">" + etiquetaCNPJ + cnpjSubsidiaria + "</td>";
      //  html += "<td style=\"font-size: 9pt; border-right:1px;\" colspan=\"1\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px; \">";
      html += "<td style=\"font-size: 9pt; \" colspan=\"2\" align=\"left\">" + addressSubsidiaria + "</td>";
      html += "<td style=\"font-size: 9pt; border-right:1px; \" colspan=\"2\" align=\"left\"> </td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size: 6pt;  \">Sacador / Avalista</td>";
      html += "<td style=\"border-right:1px;\" colspan=\"3\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 9pt;  min-height:15px\" align=\"left\"> </td>";
      html += "<td style=\"font-size: 9pt;  min-height:15px\" align=\"left\"> </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px; min-height:15px\" colspan=\"2\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom: 1px; \">";
      html += "<td style=\"font-size: 9pt;min-height:15px \" colspan=\"2\" align=\"left\"> </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px; min-height:15px \" colspan=\"2\" align=\"left\"> </td>";
      html += "</tr>";

      html += "<tr >";
      html += "<td style=\"font-size: 6pt; border-right:1px \" colspan=\"2\" >Nome do Pagador</td>";
      html += "<td style=\"font-size: 6pt; border-right:1px \" colspan=\"1\" >Data de Vencimento</td>";
      html += "<td style=\"font-size: 6pt; border-right:1px\" colspan=\"1\" >Valor do Documento</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom: 1px\">";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"2\"> " + nomCustomer + "</td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\">" + dueDateInvoice + "</td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\">" + monto + "</td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size: 6pt; border-right:1px;\" colspan=\"1\" width=\"250px\">Agência / Código do Beneficiário</td>";
      html += "<td style=\"font-size: 6pt; border-right:1px;\" colspan=\"1\" width=\"250px\">Nosso número</td>";
      html += "<td valign=\"top\" style=\"font-size:6pt;\" colspan=\"2\" rowspan=\"2\" width=\"564px\"> <p class=\"claseAM\" align=\"center\">Autenticação Mecânica</p></td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 9pt; border-right:1px; border-bottom:1px;\" colspan=\"1\" align=\"left\" width=\"150px\">" + agenciaCodBeneficiario + " </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px; border-bottom:1px;\" colspan=\"1\" align=\"left\" width=\"150px\">" + nossoNum + " </td>";
      html += "</tr>"

      html += "</table>";
      return html;

    }

    function fichaCompensacion(monto) {
      var html = "";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center;margin-top:25px; padding-top:0px\" >";
      html += "<tr>";
      html += "<td valign=\"bottom\" align=\"left\" > <img  src=\"" + xml.escape(url_logo) + "\" width=\"120\" height=\"23\"/>  </td>";
      html += "<td valign=\"bottom\"  width=\"2%\"  colspan=\"1\" > <p style=\"border-left:1px;border-right:1px; padding-left:5px ;padding-right:6px;padding-bottom:6px; font-size:5mm\"> " + codigoBanco + "-" + digitoVerificadorBanco + " </p></td>";
      html += "<td valign=\"bottom\"  width=\"78%\" align=\"right\" colspan=\"5\"> <p style=\"padding-bottom:8px; font-size:4mm\"> " + lineaDigital + "</p></td>";
      html += "</tr>";
      html += "</table>";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif;align:center; border:1px; width:185mm;height:90mm;\">";
      html += "<tr>";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"6\" width=\"138mm\">Local de Pagamento</td>";
      html += "<td style=\"font-size:6pt;background-color:#CBCCCD\" colspan=\"2\" width=\"47mm\">Vencimento</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"6\" >" + reemplazarCaracteresEspeciales(lugarPago) + "</td>";
      html += "<td valign=\"bottom\" style=\"font-size: 9pt;background-color:#CBCCCD\" align=\"left\" colspan=\"2\">" + dueDateInvoice + "</td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"6\">Beneficiário</td>";
      html += "<td style=\"font-size:6pt;\" colspan=\"2\">Agência / Código do Beneficiário</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"6\">" + nomSubsidiaria + " " + cnpjSubsidiaria + "</td>";
      html += "<td style=\"font-size: 9pt;\" align=\"left\" colspan=\"2\">" + agenciaCodBeneficiario + " </td>";
      html += "</tr>";

      html += "<tr >";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"1\">Data Documento</td>";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"2\">Nº do Documento</td>";
      html += "<td style=\"font-size:6pt; border-right:1px\" coldspan=\"1\">Espécie Doc.</td>";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"1\">Aceite</td>";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"1\">Data Processamento</td>";
      html += "<td style=\"font-size:6pt; \" colspan=\"2\">Nosso número</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\" >" + dateInvoice + " </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"2\" > " + numDocumento + " </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\" > " + especieDoc + "</td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\" >" + aceptacion + " </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\" > " + fechaProcesamiento + " </td>";
      html += "<td style=\"font-size: 9pt; \" align=\"left\" colspan=\"2\" > " + nossoNum + "</td>";
      html += "</tr>";

      html += "<tr >";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"2\">Uso do Banco</td>";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"1\">Carteira</td>";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"1\">Espécie Moeda</td>";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"1\">Quantidade Moeda</td>";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"1\">Valor Moeda</td>";
      html += "<td style=\"font-size:6pt; background-color:#CBCCCD\" colspan=\"2\">(=) Valor do Documento</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"2\" >  </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\" > " + cartera + " </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\" > " + especieMoneda + " </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\" >  </td>";
      html += "<td style=\"font-size: 9pt; border-right:1px\" align=\"left\" colspan=\"1\" >  </td>";
      html += "<td style=\"font-size: 9pt;background-color:#CBCCCD \" align=\"left\" colspan=\"2\" >" + monto + "</td>";
      html += "</tr>";

      html += "<tr >";
      html += "<td style=\"font-size:6pt; border-right:1px\" colspan=\"6\" rowspan=\"10\"> <p style=\"font-size:6pt;\" >Instruções (Texto de responsabilidade do beneficiário)</p> <p style=\"font-size:9pt; \"> " + instructions + "</p>  </td>";
      html += "<td style=\"font-size:6pt; \" colspan=\"2\" height=\"50%\">(-) Desconto / Abatimento</td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 9pt; border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" > </td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size:6pt;\" colspan=\"2\">(-) Outras deduções</td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size: 9pt;  border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size:6pt; \" colspan=\"2\">(+) Mora / Multa</td>";
      html += "</tr>";
      html += "<tr  >";
      html += "<td style=\"font-size: 9pt; border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size:6pt; \" colspan=\"2\">(+) Outros Acréscimos</td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size: 9pt; border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size:6pt; \" colspan=\"2\">(=) Valor Cobrado</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size: 9pt; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
      html += "</tr>";

      html += "<tr >";
      html += "<td style=\"font-size:6pt;\">Pagador</td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 9pt;\" align=\"left\" colspan=\"5\" >" + nomCustomer + ' ' + cnpjCustomer + "</td>";
      // html += "<td style=\"font-size: 9pt; \" align=\"left\" colspan=\"2\" >" + etiquetaCNPJ + cnpjCustomer + "</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px; \">";
      html += "<td style=\"font-size: 9pt; \" colspan=\"4\" align=\"left\">" + addressCustomer + "</td>";
      html += "</tr>";

      html += "<tr >";
      html += "<td style=\"font-size:6pt;\">Sacador / Avalista</td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 9pt;  min-height:15px\" align=\"left\" colspan=\"2\"> </td>";
      html += "<td style=\"font-size: 8pt;  min-height:15px\" align=\"left\"> </td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size: 9pt;  min-height:15px\" colspan=\"4\" align=\"left\"> </td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size:6pt;\" colspan=\"5\"></td>";
      html += "<td style=\"font-size:6pt; \" colspan=\"1\" align=\"left\">Código de Baixa</td>";
      html += "<td style=\"font-size:6pt; \" colspan=\"2\"></td>";
      html += "</tr>";
      html += "</table>";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; align:center;\">";
      html += "<tr>";
      html += "<td style=\"font-size:6pt;\" colspan=\"6\"></td>";
      html += "<td valign=\"top\" style=\"font-size:6pt; padding-top:0 ; \" colspan=\"1\"  align=\"right\">Autenticação Mecânica</td>";
      html += "<td valign=\"top\" style=\"font-size:8pt; padding-top:0 ;\" colspan=\"1\" align=\"right\" >FICHA DE COMPENSAÇÃO</td>";
      html += "</tr>";
      html += "</table>";

      //codigo de barras
      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; align:center;\">";
      html += "<tr>";
      html += "<td valign=\"middle\" align=\"center\" > <barcode codetype=\"code128\" showtext=\"false\" value=\"" + codigoBarras + "\" width=\"95%\" height=\"15mm\"/> </td>";
      html += "</tr>";
      html += "</table>";

      return html;

    }

    function acortadorDeLink(urlBoletoBancarioPdf) {
      try {
        var account = runtime.accountId;
        var wsResponse = https.post({
          url: WS_URL,
          body: JSON.stringify({
            "url": urlBoletoBancarioPdf
          }),
          headers: {
            "lmry-account": account,
            "lmry-action": "shortUrlService",
            "Content-Type": "application/json"
          }
        });
        return JSON.parse(wsResponse.body).content;
      } catch (err) {
        libraryMail.sendemail(' [ acortadorDeLink ] ' + err, LMRY_script);
      }
    }


    function formandoNossoNumero(idInvoice, cod) {
      var nossoNumero = '';
      var cadena = '';
      if(cod){
        cadena = idInvoice+cod;
      }else{
        cadena = idInvoice;
      }
      cadena = cadena.toString();

      while (cadena.length < 10) {
        cadena = "0" + cadena
      }

      if (cadena.lentgh > 10){
        cadena = cadena.substring(0, 10);
      }

      nossoNumero = cadena + ' ' + cartera.toString() + codigoEntrega.toString();

      return nossoNumero
    }

    function obtenerDatosSubsidiaria(id_subsidiaria, id_invoice) {
      if (id_subsidiaria != 0 && id_invoice != 0) {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var subsidiaria = record.load({
          type: record.Type.SUBSIDIARY,
          id: id_subsidiaria,
          isDynamic: true
        });

        /**
         * Para SuiteTax
         */
        if(ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: id_invoice,
            isDynamic: true
          });
          var transaction_nexys = transObj.getValue({fieldId: 'nexus'});
          var taxregnum_lines_subsidiaries = subsidiaria.getLineCount({ sublistId: 'taxregistration' });
          for(var x = 0; x < taxregnum_lines_subsidiaries; x++) {
            var subsidiary_nexus = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'nexus', line: x });
            if(transaction_nexys === subsidiary_nexus){
              var subsidiary_cnpj = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'taxregistrationnumber', line: x });
              break;
            }
          }
        }

        //Nombre de la subsidiaria
        var nom_subsidiaria = subsidiaria.getValue({
          fieldId: 'legalname'
        });
        if (nom_subsidiaria)
          nomSubsidiaria = reemplazarCaracteresEspeciales(nom_subsidiaria);

        //CNPJ de la subsidiaria
        var cnpj_subsidiaria = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpj_subsidiaria = subsidiaria.getValue({ fieldId: 'federalidnumber' });
        } else {
          cnpj_subsidiaria = subsidiary_cnpj;
        }
        if (cnpj_subsidiaria)
          cnpjSubsidiaria = reemplazarCaracteresEspeciales(cnpj_subsidiaria);

        //Dirección de la subsidiaria
        var address_subsidiaria = subsidiaria.getValue(
          'mainaddress_text'
        );
        if (address_subsidiaria)
          addressSubsidiaria = reemplazarCaracteresEspeciales(address_subsidiaria);

      }
      return true;
    }

    function obtenerDatosCustomer(id_customer, internalId) {
      if (id_customer != 0) {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var customer_columns = ['isperson', 'firstname', 'lastname', 'companyname'];

        /**
         * Para SuiteTax
         */
        if (ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: internalId,
            isDynamic: true
          });
          var customer_cnpj = transObj.getText({ fieldId: 'entitytaxregnum' });
        } else {
          customer_columns.push("vatregnumber");
        }

        var recordCustomer = search.lookupFields({
          type: search.Type.CUSTOMER,
          id: id_customer,
          columns: customer_columns
        });

        var nom_customer = '';
        var typeCustomer = recordCustomer.isperson

        //Si el Customer es persona natural typeCustomer es true
        if (typeCustomer == 'T' || typeCustomer == true) {
          var firtsName = recordCustomer.firstname
          var lastName = recordCustomer.lastname;

          nom_customer = firtsName + ' ' + lastName

        } else {
          nom_customer = recordCustomer.companyname
        }

        // NOMBRE DEL CLIENTE
        if (nom_customer) {
          nomCustomer = nom_customer.substring(0, 30);
          nomCustomer = reemplazarCaracteresEspeciales(nomCustomer);
        }

        //CNPJ DEL CLIENTE
        var cnpj_customer = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpj_customer = recordCustomer.vatregnumber;
        } else {
          cnpj_customer = customer_cnpj;
        }
        if (cnpj_customer)
          cnpjCustomer = reemplazarCaracteresEspeciales(cnpj_customer);

        // Direccion del Cliente
        var billAdress1 = '';
        // Numero de la direccion
        var billAdress2 = '';
        // Complemento
        var billAdress3 = '';
        // Barrio
        var billAdress4 = '';
        // Ciudad
        var billAdress5 = '';
        // Provincia
        var billAdress6 = '';
        // Zip
        var billAdress7 = '';
        // Country
        var billAdress8 = '';

        // Campos de la direccion
        var col_billadd = ['billingAddress.address1', 'billingAddress.custrecord_lmry_address_number',
          'billingAddress.custrecord_lmry_addr_reference', 'billingAddress.address2',
          'billingAddress.custrecord_lmry_addr_city', 'billingAddress.custrecord_lmry_addr_prov_acronym',
          'billingAddress.zip', 'billingAddress.country'
        ]

        // Busqueda en el record de direcciones
        var busqAddressRece = search.create({
          type: 'transaction',
          columns: col_billadd,
          filters: [
            ["internalid", "anyof", internalId],
            "AND",
            ["mainline", "is", "T"]
          ]
        });

        var resultAddress = busqAddressRece.run().getRange(0, 10);

        if (resultAddress != null && resultAddress.length != 0) {
          row = resultAddress[0].columns;
          billAdress1 = resultAddress[0].getValue(row[0]);
          if (billAdress1 == '' || billAdress1 == null) {
            billAdress1 = '';
          }
          // Numero de la direccion
          billAdress2 = resultAddress[0].getValue(row[1]);
          if (billAdress1 == '' || billAdress1 == null) {
            billAdress1 = '';
          }


          // Complemento
          billAdress3 = resultAddress[0].getValue(row[2]);
          if (billAdress3 == '' || billAdress3 == null) {
            billAdress3 = '';
          }

          // Barrio
          billAdress4 = resultAddress[0].getValue(row[3]);
          if (billAdress4 == '' || billAdress4 == null) {
            billAdress4 = '';
          }

          // Ciudad
          billAdress5 = resultAddress[0].getText(row[4]);
          if (billAdress5 == '' || billAdress5 == null) {
            billAdress5 = '';
          }

          // Provincia
          billAdress6 = resultAddress[0].getValue(row[5]);
          if (billAdress6 == '' || billAdress6 == null) {
            billAdress6 = '';
          }

          // Zip
          billAdress7 = resultAddress[0].getValue(row[6]);
          if (billAdress7 == '' || billAdress7 == null) {
            billAdress7 = '';
          }

          billAdress7 = billAdress7.replace(/[^0-9]/g, '');

          // Country
          billAdress8 = resultAddress[0].getValue(row[7]);
          if (billAdress8 == '' || billAdress8 == null) {
            billAdress8 = '';
          }

        }

        // Arma la direccion completa
        var address_customer = billAdress1 + ' ' + billAdress2 + ' ' +
          billAdress3 + ' ' + billAdress4 + ' ' +
          billAdress5 + ' ' + billAdress6 + ' ' +
          billAdress7 + ' ' + billAdress8;

        if (address_customer)
          addressCustomer = reemplazarCaracteresEspeciales(address_customer);
        // addressCustomer = addressCustomer.replace('&', '&amp;');

      }
      return true;

    }


    function formandoInstrucciones(idInvoice) {
      try {
        var valorCustomField = '';
        var vector_custom_field = [];
        vector_custom_field = custom_field.split('|');

        //vector para el SALTO DE LINEA y el TEXTO LIBRE, en este vector se guarda la data junto con su posicion correspondiente
        var vector_data_pos = [];
        //vector para los ID DE LOS CAMPOS DE TIPO CUSTBODY, en este vector se guarda la data junto con su posicion correspondiente
        var vector_id = [];


        for (var t = 0; t < vector_custom_field.length; t++) {
          //Si contiene la palabra enter, se realizará un salto de linea
          if ((vector_custom_field[t]).toLowerCase() == 'enter') {
            var enter = '<br/>'
            vector_data_pos[t] = enter;

          } else {
            var ultimaPos = vector_custom_field[t].length;
            //Si la palabra esta dentro de llaves, son ID de los campos tipo custbody
            if (vector_custom_field[t].substring(0, 1) == '{' && vector_custom_field[t].substring(ultimaPos - 1, ultimaPos) == '}') {
              vector_id[t] = vector_custom_field[t].substring(1, ultimaPos - 1);
            }
            //Si la palabra esta dentro de corchetes, son texto Libre
            if (vector_custom_field[t].substring(0, 1) == '[' && vector_custom_field[t].substring(ultimaPos - 1, ultimaPos) == ']') {
              var textoLibre = vector_custom_field[t].substring(1, ultimaPos - 1);
              vector_data_pos[t] = textoLibre;
            }
          }

        }


        var vector_cadena_final = [];

        var recordInvoice = search.lookupFields({
          type: search.Type.INVOICE,
          id: idInvoice,
          columns: vector_id
        });

        for (var pos = 0; pos < vector_id.length; pos++) {
          if (vector_id[pos]) {

            var name_id = vector_id[pos];
            var valor_id = recordInvoice[name_id];
            var type_valor_id = typeof valor_id;

            if (type_valor_id == 'object' && recordInvoice[name_id] != null && recordInvoice[name_id] != '') {
              valor_id = recordInvoice[name_id][0].text;
              valor_id = reemplazarCaracteresEspeciales(valor_id);

              vector_cadena_final[pos] = valor_id;
            }
          }
        }

        //Guardando los valores de linea de salto y los valores de texto fijo
        for (var pos = 0; pos < vector_data_pos.length; pos++) {

          var enter_textoFijo = vector_data_pos[pos];

          if (enter_textoFijo == '<br/>') {
            vector_cadena_final[pos] = enter_textoFijo;
          }
          if (enter_textoFijo != '' && enter_textoFijo != null && enter_textoFijo != '<br/>') {
            enter_textoFijo = reemplazarCaracteresEspeciales(enter_textoFijo);
            vector_cadena_final[pos] = enter_textoFijo;

          }
        }

        valorCustomField = vector_cadena_final.join(' ');
        return valorCustomField;

      } catch (err) {
        libraryMail.sendemail(' [ formandoInstrucciones ] ' + err, LMRY_script);
      }
    }

    function obtenerCodigoBarras(monto) {

      var codBarras = '';
      var campoLibre = '';
      var digitoVerificador = '';
      var factorVencimiento = '';
      var valorBoletoBancario = '';

      var valor_BoletoBancario = monto.toString();
      if (valor_BoletoBancario) {
        //Reemplaza el punto , el espacio en blanco y la coma por sin espacio, de manera global
        valorBoletoBancario = valor_BoletoBancario.replace(/\.| |\,/g, '');
      }

      while (valorBoletoBancario.length < 10) {
        valorBoletoBancario = "0" + valorBoletoBancario
      }

      campoLibre = codigoBeneficiario + nossoNum.replace(' ', '');

      //Para la obtencion del Factor de Vencimiento es necesario que no este vacio el campo de la fecha de vencimiento "DUE DATE" del invoice
      if (dataVencimiento) {
        factorVencimiento = obtenerFactorVencimiento();
      }

      var cb_parte1 = codigoBanco.toString() + codigoMoneda.toString();
      var cb_parte2 = factorVencimiento + valorBoletoBancario + campoLibre;
      var cb = cb_parte1 + cb_parte2;

      var digito = '';
      var digito_int = '';

      var i, j;
      var vector = [];

      for (i = cb.length - 1; i >= 0; i--) {
        digito = cb[i];
        digito_int = parseInt(digito);
        vector.push(digito_int);
      }

      var suma = 0;
      var digitoMultiplicado;
      var t = 2;

      for (j = 0; j < vector.length; j++) {

        if (t <= 9) {
          digitoMultiplicado = vector[j] * t;
          t++;

        } else {
          t = 2;
          digitoMultiplicado = vector[j] * t;
          t++;
        }

        var suma = suma + digitoMultiplicado;

      }

      var resto = suma % 11;
      digitoVerificador = 11 - resto;

      if (digitoVerificador == 0 || digitoVerificador == 1 || digitoVerificador == 10 || digitoVerificador == 11) {
        digitoVerificador = 1;
      }


      codBarras = cb_parte1 + digitoVerificador + cb_parte2;

      return codBarras;
    }

    function obtenerLineaDigital(codigoDeBarras) {

      var linDigital = '';
      var digVerificador1 = '';
      var digVerificador2 = '';
      var digVerificador3 = '';


      var longitud = codigoDeBarras.length;
      var campo1 = codigoDeBarras.substring(0, 4);
      var campo2 = codigoDeBarras.substring(4, 5);
      var campo3 = codigoDeBarras.substring(5, 19);
      var campo4 = codigoDeBarras.substring(19, 24);
      var campo5 = codigoDeBarras.substring(24, 34);
      var campo6 = codigoDeBarras.substring(34, 44);

      var campo_1_4 = campo1 + campo4;
      digVerificador1 = obtenerDigitoVerificadorLD(campo_1_4);
      digVerificador2 = obtenerDigitoVerificadorLD(campo5);
      digVerificador3 = obtenerDigitoVerificadorLD(campo6);


      var dig1_campo4 = campo4.substring(0, 1);
      var dig2_campo4 = campo4.substring(1, 5);
      var nuevo_campo4 = dig1_campo4 + "." + dig2_campo4;


      var dig1_campo5 = campo5.substring(0, 5);
      var dig2_campo5 = campo5.substring(5, 10);
      var nuevo_campo5 = dig1_campo5 + "." + dig2_campo5;


      var dig1_campo6 = campo6.substring(0, 5);
      var dig2_campo6 = campo6.substring(5, 10);
      var nuevo_campo6 = dig1_campo6 + "." + dig2_campo6;

      linDigital = campo1 + nuevo_campo4 + digVerificador1 + " " + nuevo_campo5 + digVerificador2 + " " + nuevo_campo6 + digVerificador3 + " " + campo2 + " " + campo3;

      return linDigital;

    }

    function obtenerDigitoVerificadorLD(campo) {
      var digVerificador = '';
      var v = [];
      var i, j;
      var digMulti;
      var suma = 0;

      for (i = campo.length - 1; i >= 0; i--) {
        digito = campo[i];
        digito_int = parseInt(digito);
        v.push(digito_int);
      }

      for (j = 0; j < v.length; j++) {

        if (j % 2 == 0) {
          digMulti = v[j] * 2;
          digMulti = obtenerSumaDigitosNumero(digMulti);
        } else {
          digMulti = v[j] * 1;
          digMulti = obtenerSumaDigitosNumero(digMulti);

        }
        suma = suma + digMulti;

      }
      var resto = suma % 10;

      digVerificador = 10 - resto;
      if (digVerificador == 10) {
        digVerificador = 0;
      }

      return digVerificador;

    }

    function obtenerSumaDigitosNumero(numero) {
      var suma = 0;
      var numeroString = numero.toString();
      var i;

      for (i = 0; i < numeroString.length; i++) {
        var digito = numeroString[i];
        digito_int = parseInt(digito);
        suma = suma + digito_int;
      }
      return suma;

    }

    function formatoFecha(fecha) {

      var formatoFecha = '';


      fecha = format.parse({
        value: fecha,
        type: format.Type.DATE
      });

      var day = fecha.getDate();
      day = day.toString();
      if (day.length == 1) {
        day = '0' + day
      }

      var month = fecha.getMonth() + 1;
      month = month.toString();
      if (month.length == 1) {
        month = '0' + month
      }

      var year = fecha.getFullYear();



      formatoFecha = day + '/' + month + '/' + year;
      return formatoFecha;
    }

    function obtenerFactorVencimiento() {
      var diferenciaDias = '';
      var fechaBase = new Date('1997/10/07');

      if (dataVencimiento != null && dataVencimiento != '') {
        var fechaVencimiento = format.parse({
          value: dataVencimiento,
          type: format.Type.DATE
        });

        var resta = fechaVencimiento.getTime() - fechaBase.getTime();
        diferenciaDias = Math.round(resta / (1000 * 60 * 60 * 24));

        while (diferenciaDias >= 9999) {
          diferenciaDias = diferenciaDias - 9000;
        }

        var diferenciaDias = diferenciaDias.toString();
        while (diferenciaDias.length < 4) {
          diferenciaDias = "0" + diferenciaDias
        }
      }
      return diferenciaDias;
    }

    function search_folder() {
      try {
        // Ruta de la carpeta contenedora
        var FolderId = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_boleto_bancario'
        });


        if (FolderId == '' || FolderId == null) {
          // Valida si existe "SuiteLatamReady" en File Cabinet
          var varIdFolderPrimary = '';

          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: ['name', 'is', 'SuiteLatamReady']
          });

          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'SuiteLatamReady');
            varIdFolderPrimary = varRecordFolder.save();
          } else {
            varIdFolderPrimary = objResult[0].getValue('internalid');
          }

          // Valida si existe "Latam BR - PDF Boleto Bancario" en File Cabinet
          var varFolderId = '';
          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: [
              ['name', 'is', 'Latam BR - PDF Boleto Bancario']
            ]
          });
          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'Latam BR - PDF Boleto Bancario');
            varRecordFolder.setValue('parent', varIdFolderPrimary);
            varFolderId = varRecordFolder.save();
          } else {
            varFolderId = objResult[0].getValue('internalid');
          }


          // Load the NetSuite Company Preferences page
          var varCompanyReference = config.load({
            type: config.Type.COMPANY_PREFERENCES
          });

          // set field values
          varCompanyReference.setValue({
            fieldId: 'custscript_lmry_br_boleto_bancario',
            value: varFolderId
          });
          // save changes to the Company Preferences page
          varCompanyReference.save();
        }



      } catch (err) {
        libraryMail.sendemail(' [ search_folder ] ' + err, LMRY_script);
      }
    }

    /*********************** MODIFICACIÓN *****************************************************
         - Fecha: 29/01/2020
         - Descripción: Funcion que reemplaza caracteres especiales tales como: <, >, ', ", &
    ******************************************************************************************/
    function reemplazarCaracteresEspeciales(cadena) {
      cadena = cadena.replace(/&gt;/g, '>');
      cadena = cadena.replace(/&lt;/g, '<');
      cadena = xml.escape(cadena);

      return cadena;
    }
    // *********************FIN MODIFICACIÓN ***********************************************


    return {
      obtenerURLPdfBoletoBancario: obtenerURLPdfBoletoBancario
    };
  });
